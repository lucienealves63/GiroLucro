import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { DEFAULT_PLAN, resolvePlan } from "@/lib/billing";
import {
  PIX_QR_MINUTES,
  createPixCharge,
  getPixPayment,
  isMercadoPagoConfigured,
} from "@/lib/mercado-pago";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const plan = resolvePlan(typeof body.cycle === "string" ? body.cycle : DEFAULT_PLAN.id);

    if (!isMercadoPagoConfigured()) {
      return NextResponse.json(
        { error: "Os pagamentos ainda não foram configurados pelo administrador." },
        { status: 503 },
      );
    }

    // Reaproveita um Pix pendente do mesmo plano, em vez de criar outro QR.
    if (user.billingCustomerId?.startsWith("pix:") && user.planCycle === plan.id) {
      const pixId = user.billingCustomerId.slice(4);
      try {
        const payment = await getPixPayment(pixId);
        const transaction = payment.point_of_interaction?.transaction_data;
        const qrCode = transaction?.qr_code ?? "";
        const qrCodeBase64 = transaction?.qr_code_base64 ?? "";
        const expiresAt = payment.date_of_expiration
          ? new Date(payment.date_of_expiration)
          : new Date(Date.now() + PIX_QR_MINUTES * 60_000);

        if (payment.status === "approved") {
          return NextResponse.json(
            { error: "O pagamento já foi confirmado. Atualize a página em instantes." },
            { status: 409 },
          );
        }

        if (payment.status === "pending" && (qrCode || qrCodeBase64) && expiresAt > new Date()) {
          return NextResponse.json({
            ok: true,
            reused: true,
            paymentId: String(payment.id),
            status: payment.status,
            qrCode,
            qrCodeBase64,
            ticketUrl: transaction?.ticket_url ?? "",
            expiresAt: expiresAt.toISOString(),
          });
        }
      } catch {
        // Se o pagamento remoto não existir mais, cria outro abaixo.
      }
    }

    const result = await createPixCharge({
      userId: user.id,
      userEmail: user.email,
      cycle: plan.id,
      priceInCents: Math.round(plan.price * 100),
    });

    await db
      .update(users)
      .set({
        billingCustomerId: `pix:${result.paymentId}`,
        planCycle: plan.id,
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      ok: true,
      reused: false,
      paymentId: result.paymentId,
      status: result.status,
      qrCode: result.qrCode,
      qrCodeBase64: result.qrCodeBase64,
      ticketUrl: result.ticketUrl,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[billing] Falha ao criar checkout Pix:", error);
    return NextResponse.json(
      { error: "Não foi possível gerar o Pix. Tente novamente." },
      { status: 502 },
    );
  }
}
