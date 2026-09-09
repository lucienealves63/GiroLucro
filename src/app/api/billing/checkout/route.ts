import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser, hasAccess } from "@/lib/auth";
import { PLANS } from "@/lib/billing";
import {
  billingDemoEnabled,
  createSubscription,
  getSubscription,
  isMercadoPagoConfigured,
} from "@/lib/mercado-pago";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const plan = PLANS.find((item) => item.id === body.cycle);
    if (!plan) return NextResponse.json({ error: "Plano inválido" }, { status: 400 });

    if (!isMercadoPagoConfigured() && !billingDemoEnabled) {
      return NextResponse.json(
        { error: "Os pagamentos ainda não foram configurados pelo administrador." },
        { status: 503 },
      );
    }

    // Evita criar várias assinaturas quando o usuário toca no botão novamente.
    if (
      isMercadoPagoConfigured() &&
      user.billingCustomerId &&
      user.planCycle === plan.id &&
      user.planStatus !== "canceled"
    ) {
      try {
        const existing = await getSubscription(user.billingCustomerId);
        if (existing.status === "pending" && existing.init_point) {
          return NextResponse.json({ ok: true, checkoutUrl: existing.init_point });
        }
        if (existing.status === "authorized") {
          return NextResponse.json(
            { error: "O pagamento está sendo confirmado. Atualize a página em instantes." },
            { status: 409 },
          );
        }
      } catch {
        // Se a assinatura remota não existir mais, cria outra abaixo.
      }
    }

    const result = await createSubscription({
      userId: user.id,
      userEmail: user.email,
      cycle: plan.id,
      priceInCents: Math.round(plan.price * 100),
      trialEndsAt: user.planStatus === "trialing" ? user.trialEndsAt : null,
    });

    if (result.mode === "demo") {
      await db
        .update(users)
        .set({
          billingCustomerId: result.subscriptionId,
          planStatus: "active",
          planCycle: plan.id,
          currentPeriodEnd: new Date(Date.now() + plan.days * 86400000),
        })
        .where(eq(users.id, user.id));
      return NextResponse.json({ ok: true, demo: true });
    }

    await db
      .update(users)
      .set({
        billingCustomerId: result.subscriptionId,
        // Trial válido continua acessível até a confirmação da cobrança.
        planStatus: hasAccess(user) ? user.planStatus : "pending_payment",
        planCycle: plan.id,
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ ok: true, checkoutUrl: result.checkoutUrl });
  } catch (error) {
    console.error("[billing] Falha ao criar checkout de assinatura:", error);
    return NextResponse.json(
      { error: "Não foi possível abrir o checkout. Tente novamente." },
      { status: 502 },
    );
  }
}
