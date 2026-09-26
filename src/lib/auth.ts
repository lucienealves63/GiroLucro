import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { isTestAccount } from "@/lib/test-accounts";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = "gl_session";
export const SESSION_DAYS = 30;
export const TRIAL_DAYS = 7;

/* ------------------------------- senha (scrypt) ---------------------------- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/* --------------------------------- sessões --------------------------------- */

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.insert(sessions).values({ token, userId, expiresAt });
  return { token, expiresAt };
}

export async function destroySession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

/**
 * Lê o usuário da sessão atual (server components e route handlers).
 * Retorna null se não autenticado.
 */
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const now = new Date();
  const query = () =>
    db
      .select({ user: users, session: sessions })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)));
  let rows: Awaited<ReturnType<typeof query>>;
  try {
    rows = await query();
  } catch (e) {
    // Banco atrás do código (coluna/tabela nova ainda não criada): aplica o
    // schema na hora e tenta de novo, em vez de derrubar a página de quem
    // está logado.
    if (!isMissingSchemaError(e)) throw e;
    console.warn("[auth] schema desatualizado — aplicando e tentando de novo");
    const { ensureSchema, resetSchemaEnsure } = await import("@/db/schema-ensure");
    resetSchemaEnsure();
    await ensureSchema();
    rows = await query();
  }
  const row = rows[0];
  if (!row) return null;
  return row.user;
}

/** 42703 = coluna inexistente · 42P01 = tabela inexistente (Postgres). */
export function isMissingSchemaError(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur && typeof cur === "object"; i++) {
    const code = (cur as { code?: unknown }).code;
    if (code === "42703" || code === "42P01") return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

/** Guarda para páginas: exige login (e opcionalmente acesso ativo). */
export async function requireUser(opts: { needsAccess?: boolean } = {}): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (opts.needsAccess && !hasAccess(user)) redirect("/assinatura");
  return user;
}

/* -------------------------------- assinatura ------------------------------- */

/**
 * Acesso aos recursos Pro.
 *
 * Contas de teste (`users.is_test`) têm acesso **sempre** — sem trial, sem
 * pagamento e sem prazo (ver `src/lib/test-accounts.ts`).
 */
export function hasAccess(
  user: Pick<User, "planStatus" | "trialEndsAt" | "currentPeriodEnd" | "isTest">,
): boolean {
  if (isTestAccount(user)) return true;
  const now = new Date();
  if (
    (user.planStatus === "active" || user.planStatus === "canceled") &&
    user.currentPeriodEnd &&
    user.currentPeriodEnd > now
  ) {
    return true;
  }
  if (
    (user.planStatus === "trialing" || user.planStatus === "pending_payment") &&
    user.trialEndsAt &&
    user.trialEndsAt > now
  ) {
    return true;
  }
  return false;
}

/**
 * Dias restantes do teste grátis — `null` quando não há teste correndo.
 * Contas de teste nunca mostram contagem: o acesso não expira.
 */
export function trialDaysLeft(
  user: Pick<User, "planStatus" | "trialEndsAt" | "isTest">,
): number | null {
  if (isTestAccount(user)) return null;
  if (user.planStatus !== "trialing" || !user.trialEndsAt) return null;
  const ms = user.trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}
