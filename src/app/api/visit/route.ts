import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pageViews, sessions } from "@/db/schema";
import {
  classifyTraffic,
  dayKey,
  isBot,
  parseUserAgent,
  sanitizePath,
  shouldTrackPath,
  VISITOR_COOKIE,
} from "@/lib/analytics";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Ingestão de visitas — alimenta o painel de acessos em /admin.
 *
 *   POST /api/visit   { path, referrer, sessionId, visitorId?, viewId?, dwellMs? }
 *   GET  /api/visit?path=/landing&vid=...   (fallback sem JavaScript / img beacon)
 *
 * O identificador do visitante é um UUID de **primeiro domínio** (cookie
 * `gl_vid`) — sem IP guardado e sem tracker de terceiros. Quando o visitante
 * tem sessão, salvamos também o `user_id`: é assim que o painel sabe quantas
 * visitas viraram conta e de onde veio cada assinante.
 */

const VALID_ID = /^[A-Za-z0-9_-]{8,64}$/;
const NO_CONTENT = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

function normalizeId(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  return VALID_ID.test(value) ? value.slice(0, 64) : "";
}

/** Usuário dono da sessão atual (se houver) — só o id, nunca o e-mail. */
async function resolveUserId(req: Request): Promise<number | null> {
  // sendBeacon não envia cookies em alguns navegadores se não for same-origin com credenciais;
  // por isso lemos também do header Cookie quando o cookie() falhar.
  let token: string | null = null;
  try {
    token = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  } catch {
    token = null;
  }
  if (!token) {
    const raw = req.headers.get("cookie");
    const match = raw ? new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(raw) : null;
    token = match?.[1] ?? null;
  }
  if (!token || token.length > 128) return null;
  try {
    const [row] = await db
      .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.token, token))
      .limit(1);
    return row && row.expiresAt.getTime() > Date.now() ? row.userId : null;
  } catch {
    return null; // medição nunca pode quebrar uma página
  }
}

async function recordView(
  req: Request,
  payload: { path: string; referrer: string | null; url: string | null; visitorId: string; sessionId: string },
): Promise<NextResponse> {
  const visitorId = payload.visitorId || crypto.randomUUID();
  const sessionId = payload.sessionId || crypto.randomUUID();

  // um visitante não gera mais de 60 eventos/min (recarregar em loop, script)
  const rl = checkRate(`visit:${clientIp(req)}:${visitorId}`, 60, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: true, throttled: true }, { status: 202 });

  const ua = req.headers.get("user-agent");
  const host = req.headers.get("host")?.replace(/:\d+$/, "") ?? null;
  let search: string | null = null;
  if (payload.url) {
    try {
      search = new URL(payload.url).search;
    } catch {
      search = null;
    }
  }

  const origin = classifyTraffic({ referrer: payload.referrer, search, selfHost: host });
  const device = parseUserAgent(ua);
  const userId = await resolveUserId(req);

  const [row] = await db
    .insert(pageViews)
    .values({
      visitorId,
      sessionId,
      path: payload.path,
      referrer: origin.referrer,
      referrerDomain: origin.referrerDomain,
      channel: origin.channel,
      source: origin.source,
      medium: origin.medium,
      campaign: origin.campaign,
      deviceType: device.device,
      browser: device.browser,
      os: device.os,
      country: (req.headers.get("x-vercel-ip-country") ?? "").slice(0, 2).toUpperCase() || null,
      language: (req.headers.get("accept-language") ?? "").split(",")[0]?.slice(0, 12) ?? null,
      userId,
      isBot: isBot(ua),
      day: dayKey(),
    })
    .returning({ id: pageViews.id });

  const res = NextResponse.json(
    { ok: true, id: row?.id ?? 0, visitorId },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
  // persiste o visitante entre sessões → contagem de "pessoas únicas"
  res.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: false, // lido pelo próprio beacon do app
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 86400,
  });
  return res;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // beacon de saída: atualiza o tempo na página da visita já registrada
    const viewIdRaw = typeof body.viewId === "string" ? body.viewId.trim() : "";
    if (/^\d{1,9}$/.test(viewIdRaw)) {
      const dwellMs = Math.max(0, Math.min(3 * 3600_000, Math.round(Number(body.dwellMs ?? 0))));
      if (dwellMs > 1000) {
        try {
          await db.update(pageViews).set({ dwellMs }).where(eq(pageViews.id, Number(viewIdRaw)));
        } catch {
          /* melhor esforço */
        }
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const path = sanitizePath(typeof body.path === "string" ? body.path : null);
    if (!path || !shouldTrackPath(path)) return NO_CONTENT as NextResponse;

    return await recordView(req, {
      path,
      referrer: typeof body.referrer === "string" ? body.referrer : req.headers.get("referer"),
      url: typeof body.url === "string" ? body.url : null,
      visitorId: normalizeId(body.visitorId),
      sessionId: normalizeId(body.sessionId),
    });
  } catch (e) {
    console.error("[visit] falha ao registrar acesso:", e instanceof Error ? e.message : e);
    return NO_CONTENT as NextResponse; // nunca estoura para o visitante
  }
}

/** Fallback sem JavaScript: <img src="/api/visit?path=/landing&vid=..."> */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const path = sanitizePath(url.searchParams.get("path"));
    if (!path || !shouldTrackPath(path)) return NO_CONTENT as NextResponse;

    let visitorId = normalizeId(url.searchParams.get("vid"));
    if (!visitorId) {
      try {
        visitorId = normalizeId((await cookies()).get(VISITOR_COOKIE)?.value ?? "");
      } catch {
        visitorId = "";
      }
    }

    return await recordView(req, {
      path,
      referrer: req.headers.get("referer"),
      url: url.search,
      visitorId,
      sessionId: "",
    });
  } catch (e) {
    console.error("[visit] falha no beacon GET:", e instanceof Error ? e.message : e);
    return NO_CONTENT as NextResponse;
  }
}
