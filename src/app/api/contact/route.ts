import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, count, eq, gt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { hashIp, sendContactNotifications, validateContact } from "@/lib/contact";
import { checkRate, clientIp } from "@/lib/rate-limit";
import { VISITOR_COOKIE } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/**
 * Recebe o formulário de /contato.
 *
 * 1. honeypot (`website`) → robô recebe 200 sem gravar nada;
 * 2. valida e **grava no banco** — a mensagem nunca se perde, mesmo sem e-mail;
 * 3. tenta a cópia por e-mail (Resend) e registra o motivo se não conseguiu;
 * 4. anti-spam: 6/h por IP no processo + máx. 5/h por IP/visitor no banco.
 */

const MAX_PER_HOUR = 5;

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    return (await req.json().catch(() => ({}))) as Record<string, unknown>;
  }
  const form = await req.formData().catch(() => null);
  if (!form) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) out[key] = value;
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req);

    // honeypot invisível: se veio preenchido, é bot
    if (String(body.website ?? "") !== "") return NextResponse.json({ ok: true });

    const ipHash = hashIp(clientIp(req));
    let visitorId: string | null = null;
    if (typeof body.visitorId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.visitorId)) {
      visitorId = body.visitorId.slice(0, 64);
    } else {
      try {
        visitorId = (await cookies()).get(VISITOR_COOKIE)?.value ?? null;
      } catch {
        visitorId = null;
      }
    }

    const rl = checkRate(`contact:${ipHash}`, MAX_PER_HOUR + 1, 3600_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Muitas mensagens seguidas. Aguarde uma hora e tente de novo." },
        { status: 429 },
      );
    }

    const parsed = validateContact(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const message = parsed.value;

    // barreira persistente: o mesmo IP/visitor não manda mais que MAX_PER_HOUR por hora
    try {
      const [freq] = await db
        .select({ n: count() })
        .from(contactMessages)
        .where(
          and(
            gt(contactMessages.createdAt, sql`now() - interval '1 hour'`),
            or(
              eq(contactMessages.ipHash, ipHash),
              visitorId ? eq(contactMessages.visitorId, visitorId) : sql`false`,
            ),
          ),
        );
      if ((freq?.n ?? 0) >= MAX_PER_HOUR) {
        return NextResponse.json(
          {
            error: "Você já enviou várias mensagens nesta hora e a gente já recebeu todas. Se for urgente, responda pelo e-mail de suporte.",
          },
          { status: 429 },
        );
      }
    } catch (e) {
      // tabela ausente/instável: não bloqueia o envio
      console.error("[contato] checagem de frequência ignorada:", e instanceof Error ? e.message : e);
    }

    const user = await getSessionUser().catch(() => null);

    const [saved] = await db
      .insert(contactMessages)
      .values({
        name: message.name,
        email: message.email,
        phone: message.phone,
        topic: message.topic,
        body: message.body,
        status: "novo",
        userId: user?.id ?? null,
        visitorId,
        sourcePath: typeof body.sourcePath === "string" ? body.sourcePath.slice(0, 120) : "/contato",
        replyToEmail: message.replyToEmail,
        ipHash,
        userAgent: (req.headers.get("user-agent") ?? "").slice(0, 240) || null,
        createdAt: new Date(),
      })
      .returning({ id: contactMessages.id });

    const mail = await sendContactNotifications({
      message,
      meta: {
        path: typeof body.sourcePath === "string" ? body.sourcePath : "/contato",
        userId: user?.id ?? null,
        ipHash,
      },
    });

    try {
      await db
        .update(contactMessages)
        .set({ emailSent: mail.ownerSent, emailError: mail.error })
        .where(eq(contactMessages.id, saved.id));
    } catch {
      /* o painel continua mostrando a mensagem de qualquer jeito */
    }

    return NextResponse.json({
      ok: true,
      id: saved.id,
      emailSent: mail.ownerSent,
      note: mail.ownerSent
        ? null
        : "Sua mensagem ficou guardada no painel do GiroLucro (a cópia por e-mail está desconfigurada, mas o time lê por lá).",
    });
  } catch (e) {
    console.error("[contato] erro ao registrar mensagem:", e);
    return NextResponse.json(
      { error: "Não conseguimos registrar sua mensagem agora. Tente de novo em instantes." },
      { status: 500 },
    );
  }
}

/** GET /api/contact → status do canal (a página usa para o aviso de fallback). */
export async function GET() {
  const { contactEmailStatus } = await import("@/lib/contact");
  const status = contactEmailStatus();
  return NextResponse.json({
    ok: true,
    emailConfigurado: status.configured,
    motivo: status.reason ?? null,
  });
}
