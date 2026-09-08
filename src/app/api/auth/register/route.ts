import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  TRIAL_DAYS,
  createSession,
  hashPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (name.length < 2 || name.length > 60) {
      return NextResponse.json({ error: "Informe seu nome" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }
    if (password.length < 8 || password.length > 72) {
      return NextResponse.json(
        { error: "A senha precisa ter entre 8 e 72 caracteres" },
        { status: 400 },
      );
    }

    const existing = await db.select().from(users).where(eq(users.email, email));
    if (existing[0]) {
      return NextResponse.json(
        { error: "Este e-mail já tem conta. Faça login." },
        { status: 409 },
      );
    }

    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash: await hashPassword(password),
        planStatus: "trialing",
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000),
      })
      .returning();

    const { token, expiresAt } = await createSession(user.id);

    const res = NextResponse.json({ ok: true, name: user.name }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 86400,
      expires: expiresAt,
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao criar conta" }, { status: 500 });
  }
}
