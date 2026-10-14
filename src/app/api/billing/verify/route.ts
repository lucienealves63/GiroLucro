import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser, hasAccess } from "@/lib/auth";
import { isTestAccount } from "@/lib/test-accounts";
import { isMercadoPagoConfigured } from "@/lib/mercado-pago";
import { verifyPendingPayment } from "@/lib/billing-activation";

export const dynamic = "force-dynamic";

type VerifyResponse = {
  ok?: boolean;
  /** A verificação acabou de liberar o vitalício agora. */
  activated?: boolean;
  /** O pagamento já estava confirmado (webhook ou verificação anterior). */
  alreadyActive?: boolean;
  /** Existe cobrança pendente que foi consultada no Mercado Pago? */
  checked?: boolean;
  reason?: string | null;
  paymentId?: string | null;
  paymentStatus?: string | null;
  hasAccess?: boolean;
  planStatus?: string | null;
  testAccount?: boolean;
  error?: string;
};

/**
 * Verificação ativa — "Já paguei, verificar".
 *
 * O webhook do Mercado Pago é o caminho oficial, mas pode não chegar
 * (sandbox/conta de teste, URL ainda não pública, secret ausente, tentativa
 * perdida). Este endpoint NÃO depende do webhook: consulta o Mercado Pago
 * diretamente pela cobrança vinculada à conta (`pix:<id>` ou `pref:<id>`) e,
 * se o pagamento estiver aprovado, promove a conta ao vitalício na hora.
 *
 * Segurança: escopo sempre ao usuário da sessão e revalida tudo
 * (referência, valor, moeda e status) antes de ativar — ver
 * `src/lib/billing-activation.ts`.
 */
export async function POST() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Re-lê a conta: o checkout pode ter acabado de gravar a cobrança pendente.
  const [user] = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Conta de teste: Pro sempre liberado, sem cobrança para verificar.
  // Acesso já ativo: nada a fazer, responde na hora (caminho rápido).
  if (isTestAccount(user) || hasAccess(user)) {
    const testAccount = isTestAccount(user);
    return NextResponse.json<VerifyResponse>({
      ok: true,
      activated: false,
      alreadyActive: true,
      checked: false,
      hasAccess: true,
      planStatus: testAccount ? "active" : user.planStatus,
      testAccount,
    });
  }

  if (!isMercadoPagoConfigured()) {
    return NextResponse.json(
      { error: "Os pagamentos ainda não foram configurados pelo administrador." },
      { status: 503 },
    );
  }

  try {
    const outcome = await verifyPendingPayment(user);

    // Re-lê a conta para devolver o estado real (pode ter ativado agora).
    const [fresh] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

    return NextResponse.json<VerifyResponse>({
      ok: true,
      activated: outcome.activation?.activated ?? false,
      alreadyActive: outcome.activation?.alreadyActive ?? false,
      checked: outcome.checked,
      reason: outcome.reason ?? outcome.activation?.reason ?? null,
      paymentId: outcome.paymentId ?? null,
      paymentStatus: outcome.paymentStatus ?? null,
      hasAccess: fresh ? hasAccess(fresh) : false,
      planStatus: fresh?.planStatus ?? user.planStatus,
    });
  } catch (error) {
    console.error(
      "[billing] verificação ativa falhou:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Não foi possível confirmar o pagamento agora. Tente novamente em instantes." },
      { status: 502 },
    );
  }
}
