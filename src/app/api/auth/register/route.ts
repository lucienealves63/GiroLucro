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
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { recordLegalAcceptance } from "@/lib/legal-acceptance";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    // Aceite obrigatório dos documentos jurídicos (LGPD art. 8º / CDC art. 30).
    // Sem o aceite explícito, a conta não é criada de forma alguma.
    const accepted = body.acceptedTermsAndPrivacy === true;
    if (!accepted) {
      return NextResponse.json(
        {
          error:
            "Para criar a conta é preciso aceitar os Termos de Uso e a Política de Privacidade.",
        },
        { status: 400 },
      );
    }

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

    const acceptedAt = new Date();
    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash: await hashPassword(password),
        planStatus: "trialing",
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000),
        // guardamos versão + data/hora do aceite (não o texto dos documentos)
        termsAcceptedAt: acceptedAt,
        termsVersion: TERMS_VERSION,
        privacyAcceptedAt: acceptedAt,
        privacyVersion: PRIVACY_VERSION,
      })
      .returning();

    // histórico auditável do aceite (documento, versão, data e origem)
    await recordLegalAcceptance(user.id, "signup", acceptedAt).catch((e) => {
      // nunca impede o cadastro: o aceite já ficou gravado na linha do usuário
      console.error("[legal] falha ao registrar histórico de aceite:", e);
    });

    const { token, expiresAt } = await createSession(user.id);

    const res = NextResponse.json({ ok: true, name: user.name }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_DAYS * 86400,
      expires: expiresAt,
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao criar conta" }, { status: 500 });
  }
}
