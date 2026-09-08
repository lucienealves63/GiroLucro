import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";

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
  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)));
  const row = rows[0];
  if (!row) return null;
  return row.user;
}

/** Guarda para páginas: exige login (e opcionalmente acesso ativo). */
export async function requireUser(opts: { needsAccess?: boolean } = {}): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (opts.needsAccess && !hasAccess(user)) redirect("/assinatura");
  return user;
}

/* -------------------------------- assinatura ------------------------------- */

export function hasAccess(user: Pick<User, "planStatus" | "trialEndsAt" | "currentPeriodEnd">): boolean {
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

export function trialDaysLeft(user: User): number | null {
  if (user.planStatus !== "trialing" || !user.trialEndsAt) return null;
  const ms = user.trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}
