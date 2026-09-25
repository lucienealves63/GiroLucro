import { eq } from "drizzle-orm";
import { SettingsClient } from "@/components/settings";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { hasAccess, requireUser, trialDaysLeft } from "@/lib/auth";
import { getAppData } from "@/lib/data";
import { costPerKm, dailyFixedShare, monthlyFixed } from "@/lib/calculations";
import { parsePlatformsJson } from "@/lib/platforms";
import { acceptanceSummary } from "@/lib/legal-acceptance";
import { refundWindowFor } from "@/lib/legal";
import { isTestAccount } from "@/lib/test-accounts";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  // Configurações ficam acessíveis mesmo sem assinatura ativa,
  // para o usuário poder gerenciar a conta. Os dados porém são dele.
  const user = await requireUser();
  const data = await getAppData(user.id);
  const s = data.settings;
  const platforms = parsePlatformsJson(s.platformsJson);

  const testAccount = isTestAccount(user);
  const trial = trialDaysLeft(user);
  let planLabel = "Teste grátis";
  if (testAccount) {
    planLabel = "Conta de teste · Pro liberado sem cobrança";
  } else if (user.planStatus === "active" && user.currentPeriodEnd) {
    // pagamento único ou legado com período muito longo (~10+ anos)
    const isSinglePayment =
      user.planCycle === "lifetime" ||
      user.planCycle === null ||
      user.currentPeriodEnd.getFullYear() >= 2100;
    planLabel = isSinglePayment
      ? "Pro · pagamento único"
      : `Pro · até ${user.currentPeriodEnd.toLocaleDateString("pt-BR")}`;
  } else if (user.planStatus === "canceled" && hasAccess(user) && user.currentPeriodEnd) {
    planLabel = `Pro até ${user.currentPeriodEnd.toLocaleDateString("pt-BR")}`;
  } else if (user.planStatus === "canceled") {
    planLabel = "Acesso encerrado";
  } else if (user.planStatus === "pending_payment") {
    planLabel = "Pagamento em confirmação";
  } else if (trial !== null && trial > 0) {
    planLabel = `Teste grátis · ${trial} ${trial === 1 ? "dia" : "dias"} restantes`;
  } else if (trial === 0) {
    planLabel = "Teste encerrado";
  }

  // Estado das notificações push desta conta (o botão em si é do cliente).
  let pushDevices = 0;
  try {
    const rows = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.id));
    pushDevices = rows.length;
  } catch (e) {
    console.error("[configuracoes] falha ao contar inscrições de push:", e);
  }

  const summary = acceptanceSummary(user);
  const windowState = refundWindowFor(user.paidAt);
  const purchase = {
    paidAt: user.paidAt?.toISOString() ?? null,
    amount: user.paymentAmount ?? null,
    provider: user.paymentProvider ?? null,
    paymentId: user.paymentId ?? null,
    paymentStatus: user.paymentStatus ?? null,
    refundStatus: user.refundStatus ?? null,
    refundRequestedAt: user.refundRequestedAt?.toISOString() ?? null,
    refundedAt: user.refundedAt?.toISOString() ?? null,
    withinWindow: windowState === "within",
    outsideWindow: windowState === "outside",
  };

  return (
    <SettingsClient
      account={{
        name: user.name,
        email: user.email,
        planLabel,
        isPro: testAccount || user.planStatus === "active" || (user.planStatus === "canceled" && hasAccess(user)),
        isTest: testAccount,
      }}
      settings={{
        vehicleType: s.vehicleType,
        vehicleName: s.vehicleName,
        kmPerLiter: s.kmPerLiter,
        fuelPrice: s.fuelPrice,
        maintenancePerKm: s.maintenancePerKm,
        fuelMode: s.fuelMode,
        monthlyRent: s.monthlyRent,
        monthlyPhone: s.monthlyPhone,
        monthlyInsurance: s.monthlyInsurance,
        initialOdometer: s.initialOdometer,
      }}
      costPerKm={costPerKm(s)}
      monthlyFixed={monthlyFixed(s)}
      dailyFixed={dailyFixedShare(s)}
      hasData={data.entries.length > 0}
      platforms={platforms}
      acceptance={{
        termsVersion: summary.terms.version,
        termsAcceptedAt: summary.terms.acceptedAt,
        termsCurrentVersion: summary.terms.currentVersion,
        termsUpToDate: summary.terms.upToDate,
        privacyVersion: summary.privacy.version,
        privacyAcceptedAt: summary.privacy.acceptedAt,
        privacyCurrentVersion: summary.privacy.currentVersion,
        privacyUpToDate: summary.privacy.upToDate,
      }}
      purchase={purchase}
      pushDevices={pushDevices}
      pushConfigured={Boolean(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
      )}
    />
  );
}
