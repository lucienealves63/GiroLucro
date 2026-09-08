import { NextResponse } from "next/server";
import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import {
  PASSWORD_RESET_MINUTES,
  createPasswordResetToken,
  getAppUrl,
  sendPasswordResetEmail,
} from "@/lib/password-reset";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_MESSAGE =
  "Se existir uma conta com esse e-mail, enviaremos as instruções para criar uma nova senha.";

export async function POST(req: Request) {
  const startedAt = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase().slice(0, 254);

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (user) {
      // Limite simples: no máximo 3 solicitações válidas por conta em 10 minutos.
      const tenMinutesAgo = new Date(Date.now() - 10 * 60_000);
      const recent = await db
        .select({ id: passwordResetTokens.id })
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            gte(passwordResetTokens.createdAt, tenMinutesAgo),
            isNull(passwordResetTokens.usedAt),
          ),
        );

      if (recent.length < 3) {
        const { token, tokenHash } = createPasswordResetToken();
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_MINUTES * 60_000);
        const resetUrl = `${getAppUrl(req)}/redefinir-senha?token=${encodeURIComponent(token)}`;

        const [row] = await db
          .insert(passwordResetTokens)
          .values({ userId: user.id, tokenHash, expiresAt })
          .returning({ id: passwordResetTokens.id });

        const delivery = await sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl,
        });

        // Sem serviço de e-mail, o token não deve ficar válido em produção.
        if (!delivery.sent && process.env.EMAIL_DEV_MODE !== "true") {
          await db
            .update(passwordResetTokens)
            .set({ usedAt: new Date() })
            .where(eq(passwordResetTokens.id, row.id));
        }

        // Somente desenvolvimento explícito: facilita testar sem enviar e-mail.
        if (
          process.env.EMAIL_DEV_MODE === "true" &&
          process.env.NODE_ENV !== "production"
        ) {
          return NextResponse.json({
            ok: true,
            message: GENERIC_MESSAGE,
            previewUrl: resetUrl,
          });
        }
      }
    }

    // Reduz diferença de tempo entre conta existente e inexistente.
    const wait = Math.max(0, 350 - (Date.now() - startedAt));
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("Forgot password error:", error);
    // Resposta genérica também em falhas: não expõe cadastro nem infraestrutura.
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }
}
