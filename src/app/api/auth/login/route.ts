import { isMissingSchemaError } from "@/lib/auth";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  createSession,
  verifyPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    const findUser = () => db.select().from(users).where(eq(users.email, email));
    let rows: Awaited<ReturnType<typeof findUser>>;
    try {
      rows = await findUser();
    } catch (e) {
      if (!isMissingSchemaError(e)) throw e;
      const { ensureSchema, resetSchemaEnsure } = await import("@/db/schema-ensure");
      resetSchemaEnsure();
      await ensureSchema();
      rows = await findUser();
    }
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos" },
        { status: 401 },
      );
    }

    const { token, expiresAt } = await createSession(user.id);

    const res = NextResponse.json({ ok: true, name: user.name });
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
    return NextResponse.json({ error: "Falha ao entrar" }, { status: 500 });
  }
}
