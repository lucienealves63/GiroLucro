import { NextResponse } from "next/server";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth";
import { DELETE_CONFIRMATION_WORD, deleteAccount } from "@/lib/account";
import { accountDeletionEmail, sendTransactionalEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/account — exclusão da conta do próprio usuário autenticado.
 *
 * Body: { confirmation: "EXCLUIR" }
 *
 * Nunca aceita id de usuário vindo do cliente: só apaga a conta da sessão.
 * Ao final, o cookie de sessão é removido e todas as sessões do usuário
 * deixam de existir no banco.
 */
export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const confirmation = String((body as Record<string, unknown>).confirmation ?? "").trim();
    if (confirmation.toUpperCase() !== DELETE_CONFIRMATION_WORD) {
      return NextResponse.json(
        { error: `Digite ${DELETE_CONFIRMATION_WORD} para confirmar a exclusão.` },
        { status: 400 },
      );
    }

    const { email, name } = user;
    const firstName = name.split(" ")[0] || "motorista";

    const { anonymized } = await deleteAccount(user);

    // Aviso pós-execução (best effort: a exclusão já aconteceu no banco).
    const mail = accountDeletionEmail({ firstName, anonymized });
    const delivery = await sendTransactionalEmail({
      to: email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    const res = NextResponse.json({
      ok: true,
      anonymized,
      emailSent: delivery.sent,
      message: anonymized
        ? "Conta excluída. Mantivemos só o registro mínimo da compra, exigido por obrigação legal."
        : "Conta e dados excluídos do GiroLucro.",
    });
    res.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (error) {
    console.error("[account] falha ao excluir conta:", error);
    return NextResponse.json(
      { error: "Não foi possível excluir a conta agora. Fale com o suporte." },
      { status: 500 },
    );
  }
}
