import { BillingClient } from "@/components/billing";
import { requireUser, trialDaysLeft } from "@/lib/auth";
import { PLANS, PRO_FEATURES } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function AssinaturaPage() {
  const user = await requireUser();
  const trial = trialDaysLeft(user);
  const isActive = user.planStatus === "active";

  let status: "active" | "trialing" | "expired" | "canceled" = "expired";
  if (isActive) status = "active";
  else if (user.planStatus === "canceled") status = "canceled";
  else if (trial !== null && trial > 0) status = "trialing";

  return (
    <BillingClient
      plans={PLANS}
      features={PRO_FEATURES}
      status={status}
      trialDaysLeft={trial}
      periodEnd={
        user.currentPeriodEnd
          ? user.currentPeriodEnd.toLocaleDateString("pt-BR")
          : null
      }
      cycle={user.planCycle}
      firstName={user.name.split(" ")[0]}
    />
  );
}
