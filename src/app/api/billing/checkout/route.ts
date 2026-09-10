import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser, hasAccess } from "@/lib/auth";
import { DEFAULT_PLAN, resolvePlan } from "@/lib/billing";
import {
  billingDemoEnabled,
  createSubscription,
  isMercadoPagoConfigured,
} from "@/lib/mercado-pago";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    // Aceita qualquer cycle enviado; sempre resolve para o plano único vitalício.
    const plan = resolvePlan(typeof body.cycle === "string" ? body.cycle : DEFAULT_PLAN.id);

    if (!isMercadoPagoConfigured() && !billingDemoEnabled) {
      return NextResponse.json(
        { error: "Os pagamentos ainda não foram configurados pelo administrador." },
        { status: 503 },
      );
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
    console.error("[billing] Falha ao criar checkout:", error);
    return NextResponse.json(
      { error: "Não foi possível abrir o checkout. Tente novamente." },
      { status: 502 },
    );
  }
}
