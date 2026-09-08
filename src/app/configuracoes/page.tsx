import { SettingsClient } from "@/components/settings";
import { hasAccess, requireUser, trialDaysLeft } from "@/lib/auth";
import { getAppData } from "@/lib/data";
import { costPerKm, dailyFixedShare, monthlyFixed } from "@/lib/calculations";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  // Configurações ficam acessíveis mesmo sem assinatura ativa,
  // para o usuário poder gerenciar a conta. Os dados porém são dele.
  const user = await requireUser();
  const data = await getAppData(user.id);
  const s = data.settings;

  const trial = trialDaysLeft(user);
  let planLabel = "Teste grátis";
  if (user.planStatus === "active" && user.currentPeriodEnd) {
    planLabel = `Pro ${user.planCycle === "yearly" ? "anual" : "mensal"} · até ${user.currentPeriodEnd.toLocaleDateString("pt-BR")}`;
  } else if (user.planStatus === "canceled" && hasAccess(user) && user.currentPeriodEnd) {
    planLabel = `Pro até ${user.currentPeriodEnd.toLocaleDateString("pt-BR")} · sem renovação`;
  } else if (user.planStatus === "canceled") {
    planLabel = "Assinatura encerrada";
  } else if (user.planStatus === "pending_payment") {
    planLabel = "Pagamento em confirmação";
  } else if (trial !== null && trial > 0) {
    planLabel = `Teste grátis · ${trial} ${trial === 1 ? "dia" : "dias"} restantes`;
  } else if (trial === 0) {
    planLabel = "Teste encerrado";
  }

  return (
    <SettingsClient
      account={{
        name: user.name,
        email: user.email,
        planLabel,
        isPro:
          user.planStatus === "active" ||
          (user.planStatus === "canceled" && hasAccess(user)),
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
    />
  );
}
