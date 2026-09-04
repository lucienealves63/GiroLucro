import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { PLANS } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * ATENÇÃO — PONTO DE INTEGRAÇÃO DE PAGAMENTO
 *
 * Hoje esta rota ativa o plano em modo demonstração (ativação instantânea).
 * Em produção, o fluxo correto é:
 *   1. Aqui, criar a preferência/assinatura no gateway (Mercado Pago, Stripe...)
 *      via SDK com a chave secreta em process.env e retornar a URL de checkout;
 *   2. O gateway confirma o pagamento e chama um webhook nosso
 *      (ex.: POST /api/billing/webhook), que valida a assinatura e só então
 *      ativa o plano do usuário (exatamente como no bloco abaixo);
 *   3. Guardar o id do cliente em users.billingCustomerId para cancelamento
 *      e renovação.
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json();
    const plan = PLANS.find((p) => p.id === body.cycle);
    if (!plan) return NextResponse.json({ error: "Plano inválido" }, { status: 400 });

    const base =
      user.currentPeriodEnd && user.currentPeriodEnd > new Date()
        ? user.currentPeriodEnd.getTime()
        : Date.now();

    await db
      .update(users)
      .set({
        planStatus: "active",
        planCycle: plan.id,
        currentPeriodEnd: new Date(base + plan.days * 86400000),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ ok: true, plan: plan.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao ativar plano" }, { status: 500 });
  }
}
