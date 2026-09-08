import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { hashPasswordResetToken } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "");
    const password = String(body.password ?? "");

    if (token.length < 32 || token.length > 200) {
      return NextResponse.json(
        { error: "Este link é inválido ou já expirou." },
        { status: 400 },
      );
    }
    if (password.length < 8 || password.length > 72) {
      return NextResponse.json(
        { error: "A nova senha precisa ter entre 8 e 72 caracteres." },
        { status: 400 },
      );
    }

    const tokenHash = hashPasswordResetToken(token);
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      // O update condicional garante uso único mesmo com duas requisições simultâneas.
      const [claimed] = await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, now),
          ),
        )
        .returning({ userId: passwordResetTokens.userId });

      if (!claimed) return false;

      await tx
        .update(users)
        .set({ passwordHash: await hashPassword(password) })
        .where(eq(users.id, claimed.userId));

      // Encerra sessões antigas caso alguém ainda tenha acesso à conta.
      await tx.delete(sessions).where(eq(sessions.userId, claimed.userId));

      // Invalida qualquer outro link pendente da mesma conta.
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetTokens.userId, claimed.userId),
            isNull(passwordResetTokens.usedAt),
          ),
        );

      return true;
    });

    if (!result) {
      return NextResponse.json(
        { error: "Este link é inválido, expirou ou já foi usado." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Senha atualizada. Entre novamente com sua nova senha.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar a senha. Tente novamente." },
      { status: 500 },
    );
  }
}
