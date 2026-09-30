import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getSessionUserByToken, SESSION_COOKIE } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/test-accounts";

/**
 * Autenticação do painel administrativo (/admin).
 *
 * Reaproveita o mesmo segredo do setup (`ADMIN_SETUP_TOKEN`) — nada de novo
 * para configurar. São três formas de entrar:
 *
 *   1. conta do dono já autenticada no app (e-mail `OWNER_TEST_EMAIL`);
 *   2. link com token:  /admin?token=SEU_TOKEN   (ótimo para o primeiro acesso);
 *   3. login pela tela: /admin → digita o token → ganha um cookie httpOnly.
 *
 * O cookie não contém o token: guarda `exp.hmac(exp)` assinado com ele, e
 * vale o mesmo token como CSRF nos formulários (double-submit).
 */

export const ADMIN_COOKIE = "gl_admin";
export const ADMIN_SESSION_HOURS = 12;

export function adminToken(): string {
  return process.env.ADMIN_SETUP_TOKEN || "girolucro-setup";
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
}

export function makeAdminCookieValue(token: string, hours = ADMIN_SESSION_HOURS): string {
  const exp = Date.now() + hours * 3600_000;
  return `${exp}.${sign(String(exp), token)}`;
}

export function verifyAdminCookieValue(value: string | undefined | null, token: string): boolean {
  if (!value) return false;
  const [expRaw, signature] = value.split(".");
  const exp = Number(expRaw);
  if (!expRaw || !signature || !Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = Buffer.from(sign(expRaw, token), "utf8");
  const given = Buffer.from(signature, "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export type AdminAccess = {
  authorized: boolean;
  /** Valor a ecoar nos formulários (CSRF). */
  csrf: string;
  /** true quando entrou pelo link com ?token= (mostra o aviso "guarde este link"). */
  viaQuery: boolean;
};

function requestCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie");
  const match = raw ? new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(raw) : null;
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

/** Checa conta autenticada do dono, cookie de admin OU `?token=` na URL. */
export async function checkAdminAccess(req: Request): Promise<AdminAccess> {
  const token = adminToken();
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken && queryToken === token) {
    return { authorized: true, csrf: token, viaQuery: true };
  }
  let cookieValue: string | undefined;
  try {
    cookieValue = (await cookies()).get(ADMIN_COOKIE)?.value;
  } catch {
    cookieValue = undefined;
  }
  cookieValue ||= requestCookie(req, ADMIN_COOKIE);
  if (verifyAdminCookieValue(cookieValue, token)) {
    return { authorized: true, csrf: cookieValue ?? "", viaQuery: false };
  }

  // Quem já entrou no app com a conta do dono também entra no painel. A sessão
  // é validada no banco e o CSRF é assinado com o segredo administrativo.
  // O try/catch preserva o acesso por token mesmo durante um setup incompleto.
  try {
    let sessionToken: string | undefined;
    try {
      sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
    } catch {
      sessionToken = undefined;
    }
    sessionToken ||= requestCookie(req, SESSION_COOKIE);
    const user = await getSessionUserByToken(sessionToken);
    if (user && sessionToken && isOwnerEmail(user.email)) {
      return {
        authorized: true,
        csrf: sign(`owner:${user.id}:${sessionToken}`, token),
        viaQuery: false,
      };
    }
  } catch (error) {
    console.error("[admin] não foi possível validar a sessão do dono:", error);
  }

  return { authorized: false, csrf: "", viaQuery: false };
}

/** POST do painel: exige o token/cookie ecoado no formulário. */
export function verifyAdminFormCsrf(formValue: string | null, access: AdminAccess): boolean {
  if (!access.authorized) return false;
  if (!formValue) return false;
  const a = Buffer.from(formValue, "utf8");
  const b = Buffer.from(access.csrf, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function adminCookieOptions(value: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: ADMIN_SESSION_HOURS * 3600,
    secure: process.env.NODE_ENV === "production",
    value,
  };
}
