import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { billingDemoEnabled, cancelSubscription } from "@/lib/mercado-pago";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/cancel — LEGADO, mantido apenas para assinaturas
 * recorrentes antigas (planos "monthly"/"yearly" criados antes do modelo de
 * pagamento único).
 *
 * O GiroLucro hoje vende **pagamento único**: não existe mensalidade para
 * cancelar. Por isso esta rota:
 *   • só para uma cobrança recorrente real (id de preapproval), interrompe as
 *     próximas cobranças;
 *   • para todo o resto, responde explicitamente que não há assinatura —
 *     sem mexer no acesso já pago, sem tratar a compra como mensalidade.
 *
 * O caminho correto para o usuário atual é:
 *   • arrependimento/reembolso → POST /api/billing/refund
 *   • apagar a conta          → DELETE /api/account
 */

/** Id de preapproval real do Mercado Pago (assinatura recorrente legada). */
function isLegacyRecurringId(id: string | null): boolean {
  if (!id) return false;
  if (id.startsWith("pix:") || id.startsWith("pref:") || id.startsWith("demo-")) return false;
  if (id.startsWith("pay:")) return false;
  return /^\d{4,}$|^[a-f0-9-]{20,}$/i.test(id);
}

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const legacyRecurring =
      isLegacyRecurringId(user.billingCustomerId) &&
      (user.planCycle === "monthly" || user.planCycle === "yearly");

    if (!legacyRecurring) {
      return NextResponse.json({
        ok: true,
        noSubscription: true,
        message:
          "O GiroLucro Pro é compra de pagamento único — não existe mensalidade nem renovação automática para cancelar. Se quiser desfazer a compra, use a solicitação de arrependimento e reembolso. Para apagar sua conta e seus dados, use a exclusão de conta em Configurações.",
        refundEndpoint: "/api/billing/refund",
        deleteAccountEndpoint: "/api/account",
      });
    }

    if (user.billingCustomerId?.startsWith("demo-") && !billingDemoEnabled) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
    }

    await cancelSubscription(user.billingCustomerId as string);

    // Só a assinatura recorrente legada encerra o plano.
    await db.update(users).set({ planStatus: "canceled" }).where(eq(users.id, user.id));

    return NextResponse.json({
      ok: true,
      legacyRecurring: true,
      message: "Cobranças recorrentes antigas foram interrompidas.",
    });
  } catch (error) {
    console.error("[billing] falha ao cancelar assinatura legada:", error);
    return NextResponse.json(
      { error: "Não foi possível cancelar agora. Tente novamente." },
      { status: 502 },
    );
  }
}

/** Navegador/teste: explica o modelo atual sem alterar nada. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    model: "single_payment",
    message:
      "Este endpoint existe só para assinaturas recorrentes antigas. Compras novas são de pagamento único.",
  });
}
