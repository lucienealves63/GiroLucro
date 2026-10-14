import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { billingEvents, users, type User } from "@/db/schema";
import { DEFAULT_PLAN, type Plan } from "@/lib/billing";
import {
  getPixPayment,
  parseGiroLucroReference,
  searchPaymentsByPreference,
  type MercadoPagoPayment,
} from "@/lib/mercado-pago";
import { sendPurchaseReceipt } from "@/lib/purchase";

/**
 * Ativação vitalícia por **verificação ativa**.
 *
 * O webhook do Mercado Pago é o caminho oficial, mas em cenários reais ele
 * pode não chegar (ambiente de teste/sandbox, URL do app não pública ainda,
 * secret ausente, tentativas esgotadas…). Sem um caminho ativo, a pessoa paga,
 * o Mercado Pago aprova — e nada muda na conta.
 *
 * Este módulo permite ao próprio app perguntar ao Mercado Pago o resultado do
 * pagamento vinculado à conta (`billingCustomerId` = `pix:<id>` ou
 * `pref:<id>`) e promover o usuário para o plano vitalício com as MESMAS
 * validações e o MESMO registro comercial do webhook:
 *
 *   • pagamento aprovado, em BRL, no valor exato do plano;
 *   • `external_reference` apontando para o próprio usuário logado;
 *   • idempotência por `billing_events` (reverificar não duplica nada);
 *   • recibo enviado uma única vez por compra.
 */

export type LifetimePaymentCheck =
  | { ok: true; amount: number; paidAt: Date }
  | { ok: false; reason: "reference" | "user" | "status" | "currency" | "amount" | "unknown" };

/**
 * Valida um pagamento do Mercado Pago para liberação do plano único.
 * Espelha exatamente as validações do webhook (`/api/billing/webhook`).
 */
export function checkLifetimePayment(
  payment: MercadoPagoPayment | null | undefined,
  user: Pick<User, "id">,
  plan: Plan = DEFAULT_PLAN,
): LifetimePaymentCheck {
  if (!payment) return { ok: false, reason: "unknown" };

  const reference = parseGiroLucroReference(payment.external_reference);
  if (!reference) return { ok: false, reason: "reference" };
  if (reference.userId !== user.id) return { ok: false, reason: "user" };
  if (payment.status !== "approved") return { ok: false, reason: "status" };
  if (String(payment.currency_id ?? "").toUpperCase() !== "BRL") {
    return { ok: false, reason: "currency" };
  }

  const amount = Number(payment.transaction_amount);
  if (!Number.isFinite(amount) || Math.abs(amount - plan.price) >= 0.011) {
    return { ok: false, reason: "amount" };
  }

  const paidRaw = payment.date_approved ?? payment.date_created;
  const paidAt = paidRaw ? new Date(paidRaw) : new Date();
  return {
    ok: true,
    amount,
    paidAt: Number.isFinite(paidAt.getTime()) ? paidAt : new Date(),
  };
}

/**
 * Campos gravados no usuário quando o pagamento único é confirmado.
 * Fonte única usada pelo webhook E pela verificação ativa, para que os dois
 * caminhos sempre deixem a conta no mesmo estado comercial.
 */
export function buildLifetimeUserUpdate(
  payment?: {
    id: string | number;
    provider: string;
    amount?: number;
    paidAt?: Date;
  },
) {
  return {
    planStatus: "active",
    planCycle: "lifetime",
    currentPeriodEnd: new Date(Date.now() + DEFAULT_PLAN.days * 86_400_000),
    ...(payment
      ? {
          paymentId: String(payment.id),
          paymentProvider: payment.provider,
          paidAt: payment.paidAt ?? new Date(),
          ...(Number.isFinite(payment.amount) ? { paymentAmount: payment.amount } : {}),
          paymentStatus: "approved",
        }
      : {}),
  };
}

export type ActivationResult = {
  /** A verificação acabou de liberar o vitalício agora. */
  activated: boolean;
  /** O pagamento já estava processado antes (webhook ou verificação anterior). */
  alreadyActive: boolean;
  reason?: string;
};

/**
 * Promove o usuário a vitalício a partir de um pagamento aprovado no Mercado
 * Pago. Idempotente: reverificar o mesmo pagamento nunca duplica recibo,
 * evento ou cobrança.
 */
export async function activateLifetimeFromPayment(
  user: User,
  payment: MercadoPagoPayment,
  options: { provider?: string; eventKeyPrefix?: string } = {},
): Promise<ActivationResult> {
  const provider = options.provider ?? "mercado_pago";
  const check = checkLifetimePayment(payment, user);
  if (!check.ok) {
    return { activated: false, alreadyActive: false, reason: check.reason };
  }

  const paymentId = String(payment.id);

  // Já processado antes (webhook chegou primeiro ou verificação repetida)?
  if (
    user.paymentId === paymentId &&
    user.paymentStatus === "approved" &&
    user.planStatus === "active"
  ) {
    return { activated: false, alreadyActive: true };
  }

  const eventKey = `${options.eventKeyPrefix ?? "verify"}:payment:${paymentId}`;

  // Idempotência compartilhada com o webhook (mesma tabela billing_events).
  await db
    .insert(billingEvents)
    .values({
      provider: "mercado_pago",
      eventKey,
      eventType: "payment",
      resourceId: paymentId,
      userId: user.id,
      status: "processing",
    })
    .onConflictDoNothing();

  // Recibo somente na primeira confirmação desta compra.
  const isNewPurchase = user.paymentId !== paymentId;

  await db
    .update(users)
    .set(
      buildLifetimeUserUpdate({
        id: payment.id,
        provider,
        amount: check.amount,
        paidAt: check.paidAt,
      }),
    )
    .where(eq(users.id, user.id));

  await db
    .update(billingEvents)
    .set({ userId: user.id, status: "processed" })
    .where(and(eq(billingEvents.provider, "mercado_pago"), eq(billingEvents.eventKey, eventKey)));

  if (isNewPurchase) {
    await sendPurchaseReceipt(user, {
      paymentId,
      provider,
      amount: check.amount,
      paidAt: check.paidAt,
    }).catch((e) => {
      console.error(
        "[billing] falha ao enviar o recibo (verificação ativa):",
        e instanceof Error ? e.message : e,
      );
    });
  }

  return { activated: true, alreadyActive: false };
}

export type VerificationOutcome = {
  /** Existe uma cobrança pendente vinculada à conta que foi consultada? */
  checked: boolean;
  reason?: "no_pending_charge" | "reference" | "user" | "status" | "currency" | "amount" | "unknown";
  paymentId?: string;
  paymentStatus?: string | null;
  activation?: ActivationResult;
};

/**
 * Verificação ativa da cobrança pendente da conta.
 *
 *  • `pix:<id>`      → consulta o pagamento Pix diretamente;
 *  • `pref:<id>`     → busca pagamentos da preferência do Checkout Pro;
 *  • sem cobrança    → `checked: false` (nada a verificar).
 *
 * Se o pagamento estiver aprovado e válido, promove a conta a vitalícia.
 */
export async function verifyPendingPayment(user: User): Promise<VerificationOutcome> {
  const customerId = user.billingCustomerId ?? "";

  if (customerId.startsWith("pix:")) {
    const paymentId = customerId.slice(4);
    const payment = await getPixPayment(paymentId);
    const check = checkLifetimePayment(payment, user);
    if (!check.ok) {
      return {
        checked: true,
        reason: check.reason,
        paymentId,
        paymentStatus: payment?.status ?? null,
      };
    }
    const activation = await activateLifetimeFromPayment(user, payment);
    return { checked: true, paymentId, paymentStatus: payment.status ?? null, activation };
  }

  if (customerId.startsWith("pref:")) {
    const preferenceId = customerId.slice(5);
    const payments = await searchPaymentsByPreference(preferenceId);
    const mine = payments.find(
      (p) => parseGiroLucroReference(p.external_reference)?.userId === user.id,
    );
    const approved = payments.find((p) => p.status === "approved" && p.id);
    const payment = approved ?? mine ?? null;
    if (!payment) {
      return {
        checked: true,
        reason: "status",
        paymentStatus: null,
      };
    }
    const check = checkLifetimePayment(payment, user);
    if (!check.ok) {
      return {
        checked: true,
        reason: check.reason,
        paymentId: String(payment.id),
        paymentStatus: payment.status ?? null,
      };
    }
    const activation = await activateLifetimeFromPayment(user, payment);
    return {
      checked: true,
      paymentId: String(payment.id),
      paymentStatus: payment.status ?? null,
      activation,
    };
  }

  return { checked: false, reason: "no_pending_charge" };
}
