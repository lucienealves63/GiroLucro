import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { billingDemoEnabled, cancelSubscription } from "@/lib/mercado-pago";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    if (user.billingCustomerId && !user.billingCustomerId.startsWith("demo-")) {
      await cancelSubscription(user.billingCustomerId);
    } else if (user.billingCustomerId?.startsWith("demo-") && !billingDemoEnabled) {
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
    }

    const trialStillValid =
      user.trialEndsAt !== null && user.trialEndsAt.getTime() > Date.now();
    const paidPeriodStillValid =
      user.currentPeriodEnd !== null && user.currentPeriodEnd.getTime() > Date.now();

    await db
      .update(users)
      .set(
        paidPeriodStillValid
          ? { planStatus: "canceled" }
          : trialStillValid
            ? {
                planStatus: "trialing",
                planCycle: null,
                billingCustomerId: null,
              }
            : {
                planStatus: "canceled",
                planCycle: null,
                billingCustomerId: null,
              },
      )
      .where(eq(users.id, user.id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Cancel error:", error);
    return NextResponse.json(
      { error: "Não foi possível cancelar agora. Tente novamente." },
      { status: 502 },
    );
  }
}
