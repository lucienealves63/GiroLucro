import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { billingEvents, users, type User } from "@/db/schema";
import { DEFAULT_PLAN, resolvePlan, type Plan } from "@/lib/billing";
import {
  getAuthorizedPayment,
  getPayment,
  getSubscription,
  isMercadoPagoConfigured,
  parseGiroLucroReference,
  verifyMercadoPagoSignature,
  type MercadoPagoSubscription,
} from "@/lib/mercado-pago";

export const dynamic = "force-dynamic";

type WebhookBody = {
  id?: string | number;
  type?: string;
  action?: string;
  date_created?: string;
  data?: { id?: string | number };
};

function validSubscriptionForUser(
  subscription: MercadoPagoSubscription,
  user: User,
  plan: Plan,
): boolean {
  const reference = parseGiroLucroReference(subscription.external_reference);
  const amount = Number(subscription.auto_recurring?.transaction_amount);
  const payerMatches =
    !subscription.payer_email ||
    subscription.payer_email.toLowerCase() === user.email.toLowerCase();

  // Planos legados (assinatura) ou preferência única
  return (
    !!reference &&
    reference.userId === user.id &&
    user.billingCustomerId === subscription.id &&
    Number.isFinite(amount) &&
    Math.abs(amount - plan.price) < 0.011 &&
    subscription.auto_recurring?.currency_id === "BRL" &&
    payerMatches
  );
}

function periodEndFrom(
  subscription: MercadoPagoSubscription,
  plan: Plan,
  chargeDate?: string,
): Date {
  const nextPayment = subscription.next_payment_date
    ? new Date(subscription.next_payment_date)
    : null;
  if (nextPayment && Number.isFinite(nextPayment.getTime()) && nextPayment > new Date()) {
    return nextPayment;
  }

  const anchor = chargeDate ? new Date(chargeDate) : new Date();
  const safeAnchor = Number.isFinite(anchor.getTime()) ? anchor : new Date();
  return new Date(safeAnchor.getTime() + plan.days * 86400000);
}

async function findValidatedContext(subscription: MercadoPagoSubscription) {
  const reference = parseGiroLucroReference(subscription.external_reference);
  if (!reference) return null;

  const [user] = await db.select().from(users).where(eq(users.id, reference.userId)).limit(1);
  const plan = resolvePlan(reference.cycle);
  if (!user || !plan || !validSubscriptionForUser(subscription, user, plan)) return null;
  return { user, plan };
}

async function activateLifetime(userId: number, eventId: number) {
  const currentPeriodEnd = new Date(Date.now() + DEFAULT_PLAN.days * 86400000);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        planStatus: "active",
        planCycle: "lifetime",
        currentPeriodEnd,
      })
      .where(eq(users.id, userId));
    await tx
      .update(billingEvents)
      .set({ userId, status: "processed" })
      .where(eq(billingEvents.id, eventId));
  });
}

/**
 * Webhook oficial do Mercado Pago.
 * Tópicos: payment (Pix + Checkout Pro), e legados de assinatura.
 */
export async function POST(req: Request) {
  let claimedEventId: number | null = null;
  try {
    if (!isMercadoPagoConfigured() || !process.env.MERCADO_PAGO_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Billing não configurado" }, { status: 503 });
    }

    const body = (await req.json()) as WebhookBody;
    const url = new URL(req.url);
    const resourceId = String(url.searchParams.get("data.id") ?? body.data?.id ?? "");
    const eventType = String(url.searchParams.get("type") ?? body.type ?? "");

    if (!verifyMercadoPagoSignature(req, resourceId)) {
      console.warn("Mercado Pago webhook com assinatura inválida", resourceId);
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
    }

    // Outros tópicos assinados podem ser ignorados sem provocar novas tentativas.
    if (
      ![
        "subscription_preapproval",
        "subscription_authorized_payment",
        "payment",
      ].includes(eventType)
    ) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const eventKey = body.id
      ? `${eventType}:${body.id}`
      : `${eventType}:${resourceId}:${body.action ?? "update"}:${body.date_created ?? "unknown"}`;

    // Reenvios do mesmo webhook não alteram novamente o período de assinatura.
    const [claimed] = await db
      .insert(billingEvents)
      .values({
        provider: "mercado_pago",
        eventKey,
        eventType,
        resourceId,
        status: "processing",
      })
      .onConflictDoNothing()
      .returning({ id: billingEvents.id });
    if (!claimed) return NextResponse.json({ ok: true, duplicate: true });
    claimedEventId = claimed.id;

    let subscription: MercadoPagoSubscription;
    let paymentApproved = false;
    let chargeDate: string | undefined;
    let chargedAmount: number | undefined;
    let chargedCurrency: string | undefined;

    if (eventType === "subscription_preapproval") {
      subscription = await getSubscription(resourceId);
    } else if (eventType === "subscription_authorized_payment") {
      const invoice = await getAuthorizedPayment(resourceId);
      subscription = await getSubscription(invoice.preapproval_id);
      paymentApproved = invoice.payment?.status === "approved";
      chargeDate = invoice.debit_date ?? invoice.date_created;
    } else {
      // payment — Pix à vista ou Checkout Pro (pagamento único)
      const payment = await getPayment(resourceId);
      const reference = parseGiroLucroReference(payment.external_reference);
      if (!reference) {
        await db
          .update(billingEvents)
          .set({ status: "ignored" })
          .where(eq(billingEvents.id, claimed.id));
        return NextResponse.json({ ok: true, ignored: true });
      }
      const [referencedUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, reference.userId))
        .limit(1);
      const referencedPlan = resolvePlan(reference.cycle);
      if (!referencedUser || !referencedPlan) {
        await db
          .update(billingEvents)
          .set({ status: "rejected" })
          .where(eq(billingEvents.id, claimed.id));
        return NextResponse.json({ ok: true, rejected: true });
      }

      const payAmount = Number(payment.transaction_amount);
      const validAmount =
        Number.isFinite(payAmount) && Math.abs(payAmount - referencedPlan.price) < 0.011;
      const validCurrency = String(payment.currency_id ?? "").toUpperCase() === "BRL";
      const payApproved = payment.status === "approved";

      // Pix à vista ou Checkout Pro (pagamento único vitalício)
      const isPix = referencedUser.billingCustomerId === `pix:${String(payment.id)}`;
      const isPreference = referencedUser.billingCustomerId?.startsWith("pref:") ?? false;
      const isLifetimeRef = reference.cycle === "lifetime";

      if (isPix || isPreference || isLifetimeRef) {
        if (payApproved && validAmount && validCurrency) {
          await activateLifetime(referencedUser.id, claimed.id);
          if (!referencedUser.billingCustomerId?.startsWith("pix:")) {
            await db
              .update(users)
              .set({
                billingCustomerId:
                  referencedUser.billingCustomerId ?? `pay:${String(payment.id)}`,
              })
              .where(eq(users.id, referencedUser.id));
          }
          return NextResponse.json({ ok: true, activated: true });
        }

        const payStatus =
          !payApproved && payment.status !== "rejected" ? "observed" : "rejected";
        await db
          .update(billingEvents)
          .set({ userId: referencedUser.id, status: payStatus })
          .where(eq(billingEvents.id, claimed.id));
        return NextResponse.json({ ok: true, activated: false });
      }

      // Ramo legado (assinatura recorrente)
      if (!referencedUser.billingCustomerId || referencedUser.billingCustomerId.startsWith("pix:") || referencedUser.billingCustomerId.startsWith("pref:")) {
        await db
          .update(billingEvents)
          .set({ status: "rejected" })
          .where(eq(billingEvents.id, claimed.id));
        return NextResponse.json({ ok: true, rejected: true });
      }

      subscription = await getSubscription(referencedUser.billingCustomerId);
      paymentApproved = payment.status === "approved";
      chargeDate = payment.date_approved ?? payment.date_created;
      chargedAmount = Number(payment.transaction_amount);
      chargedCurrency = payment.currency_id;
    }

    const context = await findValidatedContext(subscription);
    if (!context) {
      await db
        .update(billingEvents)
        .set({ status: "rejected" })
        .where(eq(billingEvents.id, claimed.id));
      return NextResponse.json({ ok: true, rejected: true });
    }
    const { user, plan } = context;

    if (
      paymentApproved &&
      (!Number.isFinite(chargedAmount) ||
        Math.abs((chargedAmount ?? 0) - plan.price) >= 0.011 ||
        chargedCurrency !== "BRL")
    ) {
      await db
        .update(billingEvents)
        .set({ userId: user.id, status: "rejected" })
        .where(eq(billingEvents.id, claimed.id));
      return NextResponse.json({ ok: true, rejected: true });
    }

    if (subscription.status === "cancelled" || subscription.status === "paused") {
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ planStatus: "canceled" })
          .where(eq(users.id, user.id));
        await tx
          .update(billingEvents)
          .set({ userId: user.id, status: "processed" })
          .where(eq(billingEvents.id, claimed.id));
      });
      return NextResponse.json({ ok: true, subscription: subscription.status });
    }

    if (paymentApproved) {
      // Mesmo em assinaturas legadas, promove para lifetime com o preço atual
      await activateLifetime(user.id, claimed.id);
      return NextResponse.json({ ok: true, activated: true });
    }

    // Assinatura autorizada sem cobrança aprovada ainda não libera plano pago.
    await db
      .update(billingEvents)
      .set({ userId: user.id, status: "observed" })
      .where(eq(billingEvents.id, claimed.id));
    return NextResponse.json({ ok: true, activated: false });
  } catch (error) {
    console.error("Mercado Pago webhook error:", error);
    // Libera o evento em processamento para uma nova tentativa do Mercado Pago.
    if (claimedEventId !== null) {
      await db
        .delete(billingEvents)
        .where(eq(billingEvents.id, claimedEventId))
        .catch(() => undefined);
    }
    return NextResponse.json({ error: "Falha temporária" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ready:
      isMercadoPagoConfigured() && !!process.env.MERCADO_PAGO_WEBHOOK_SECRET,
    endpoint: "/api/billing/webhook",
  });
}
