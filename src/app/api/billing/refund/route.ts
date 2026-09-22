import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { logDataSubjectRequest } from "@/lib/account";
import { refundRequestEmail, sendTransactionalEmail } from "@/lib/email";
import { REFUND_WINDOW_DAYS, formatDateTimeBR } from "@/lib/legal";
import { isMercadoPagoConfigured, refundPayment } from "@/lib/mercado-pago";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/refund — direito de arrependimento (CDC art. 49).
 *
 * Isso NÃO é "cancelar assinatura": o GiroLucro é vendido em pagamento único.
 * Aqui o titular pede a devolução do valor e, quando o pedido é aceito, o
 * acesso Pro é encerrado (o contrato é desfeito).
 *
 * Verificações antes de qualquer chamada ao provedor:
 *  1. usuário autenticado;
 *  2. existe pagamento pertencente a ele (paymentId/paidAt na própria conta);
 *  3. status do pagamento permite estorno;
 *  4. não existe pedido anterior em andamento nem reembolso já feito;
 *  5. prazo legal calculado sobre a data do pagamento.
 *
 * Idempotência: a "posse" do pedido é tomada por um UPDATE condicional, então
 * duas requisições simultâneas nunca estornam a mesma compra duas vezes.
 */

const DAY_MS = 86_400_000;

type RefundOutcome = "refunded" | "manual" | "processing";

function isAlreadyResolved(status: string | null): boolean {
  return status === "refunded" || status === "charged_back";
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const reason =
      typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : null;

    // 1. existe compra registrada nesta conta?
    if (!user.paymentId || !user.paidAt) {
      return NextResponse.json(
        {
          error:
            "Não encontramos uma compra paga nesta conta. Se você pagou por outro e-mail, fale com o suporte.",
          code: "no_payment",
        },
        { status: 409 },
      );
    }

    // 2/3. status do pagamento e reembolsos anteriores
    if (isAlreadyResolved(user.refundStatus) || user.paymentStatus === "refunded") {
      return NextResponse.json(
        {
          error: user.refundedAt
            ? `Esta compra já foi reembolsada em ${formatDateTimeBR(user.refundedAt)}.`
            : "Esta compra já foi reembolsada.",
          code: "already_refunded",
        },
        { status: 409 },
      );
    }
    // "manual" também conta como pedido em andamento: não pode ser reenviado
    // e nem recolocado na fila duas vezes.
    if (
      user.refundStatus === "requested" ||
      user.refundStatus === "processing" ||
      user.refundStatus === "manual"
    ) {
      return NextResponse.json(
        {
          error: `Você já tem um pedido de reembolso em análise (aberto em ${formatDateTimeBR(user.refundRequestedAt)}). A gente responde pelo e-mail da conta.`,
          code: "already_requested",
        },
        { status: 409 },
      );
    }

    // 4. toma posse do pedido de forma atômica (idempotência)
    const now = new Date();
    const [claimed] = await db
      .update(users)
      .set({ refundStatus: "processing", refundRequestedAt: now })
      .where(
        and(
          eq(users.id, user.id),
          sql`${users.refundStatus} is distinct from 'refunded'`,
          sql`${users.refundStatus} is distinct from 'requested'`,
          sql`${users.refundStatus} is distinct from 'processing'`,
          sql`${users.refundStatus} is distinct from 'manual'`,
          eq(users.paymentId, user.paymentId),
        ),
      )
      .returning({ id: users.id });

    if (!claimed) {
      return NextResponse.json(
        { error: "Já existe um pedido de reembolso para esta compra.", code: "already_requested" },
        { status: 409 },
      );
    }

    // 5. prazo do arrependimento
    const daysSincePurchase = Math.floor((now.getTime() - user.paidAt.getTime()) / DAY_MS);
    const withinWindow = daysSincePurchase <= REFUND_WINDOW_DAYS;
    const paidViaProvider =
      !!user.paymentId &&
      (user.paymentProvider === "mercado_pago" || user.paymentProvider === null) &&
      !user.paymentId.startsWith("demo-") &&
      isMercadoPagoConfigured();

    let outcome: RefundOutcome = "manual";
    let providerNote = "pedido interno para análise manual";

    if (withinWindow && paidViaProvider) {
      try {
        await refundPayment(user.paymentId);
        outcome = "refunded";
        providerNote = "estorno executado na API do Mercado Pago";
      } catch (error) {
        // Falha técnica não invalida o direito do consumidor: vira pedido manual.
        outcome = "manual";
        providerNote = `estorno automático indisponível (${
          error instanceof Error ? error.message : "erro desconhecido"
        })`;
        console.error("[billing] falha no estorno automático:", error);
      }
    } else if (!withinWindow) {
      providerNote = `pedido fora do prazo de ${REFUND_WINDOW_DAYS} dias — análise manual`;
    } else if (!paidViaProvider) {
      providerNote = "pagamento sem estorno automático disponível — processamento manual";
    }

    const finished = outcome === "refunded";

    await db
      .update(users)
      .set(
        finished
          ? {
              refundStatus: "refunded",
              refundedAt: now,
              paymentStatus: "refunded",
              // contrato desfeito: o acesso Pro é encerrado
              planStatus: "canceled",
              currentPeriodEnd: null,
            }
          : { refundStatus: "manual" },
      )
      .where(eq(users.id, user.id));

    await logDataSubjectRequest({
      userId: user.id,
      requestType: "refund",
      status: finished ? "done" : "processing",
      note: providerNote,
    });

    const mail = refundRequestEmail({
      firstName: user.name.split(" ")[0] || "motorista",
      amount: user.paymentAmount ?? null,
      paidAt: user.paidAt,
      automatic: !finished && withinWindow,
      refunded: finished,
    });
    const delivery = await sendTransactionalEmail({
      to: user.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });

    if (reason) {
      console.info(
        `[billing] reembolso solicitado pelo usuário ${user.id} — motivo informado: ${reason.slice(0, 120)}`,
      );
    }

    return NextResponse.json({
      ok: true,
      status: finished ? "refunded" : "manual",
      withinWindow,
      emailSent: delivery.sent,
      message: finished
        ? "Recebemos seu pedido de reembolso. O estorno foi solicitado ao Mercado Pago e o acesso Pro foi encerrado."
        : "Recebemos seu pedido de reembolso. Ele entrou na fila de análise manual e a resposta chega pelo e-mail da sua conta.",
    });
  } catch (error) {
    console.error("[billing] falha na solicitação de reembolso:", error);
    return NextResponse.json(
      { error: "Não foi possível registrar o pedido agora. Tente novamente." },
      { status: 502 },
    );
  }
}
