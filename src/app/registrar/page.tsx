import { RegisterClient, type RegisterItem } from "@/components/register";
import { requireUser } from "@/lib/auth";
import { computeRange, costPerKm } from "@/lib/calculations";
import { getAppData } from "@/lib/data";
import {
  EXPENSE_META,
  hrs,
  km as fmtKm,
  lastNDays,
  timeAgo,
  todayStr,
} from "@/lib/format";
import {
  enabledPlatforms,
  parsePlatformsJson,
  resolvePlatformMeta,
} from "@/lib/platforms";

export const dynamic = "force-dynamic";

export default async function RegistrarPage() {
  const user = await requireUser({ needsAccess: true });
  const data = await getAppData(user.id);
  const today = todayStr();
  const s = data.settings;
  const allPlatforms = parsePlatformsJson(s.platformsJson);
  const platforms = enabledPlatforms(allPlatforms);

  const range14 = computeRange(lastNDays(today, 14), data.entries, data.expenses, s);

  const items: RegisterItem[] = [
    ...data.entries
      .filter((e) => e.date === today)
      .map((e) => {
        const meta = resolvePlatformMeta(e.platform, allPlatforms);
        const unit = meta.unit;
        return {
          id: e.id,
          kind: "entry" as const,
          label: `${meta.label}${e.quantity > 1 ? ` · ${e.quantity} ${unit}s` : ""}`,
          sub: `${hrs(e.hours)} · ${fmtKm(e.km)}${e.waitMinutes > 0 ? ` · ${Math.round(e.waitMinutes)}min espera` : ""}${!e.settled ? " · a receber" : ""}`,
          amount: e.gross,
          positive: true,
          platform: e.platform,
          when: timeAgo(e.date, today),
          createdAt: new Date(e.createdAt).getTime(),
        };
      }),
    ...data.expenses
      .filter((e) => e.date === today)
      .map((x) => ({
        id: x.id,
        kind: "expense" as const,
        label: EXPENSE_META[x.type]?.label ?? "Gasto",
        sub: x.note ?? "",
        amount: x.amount,
        positive: false,
        platform: x.type,
        when: timeAgo(x.date, today),
        createdAt: new Date(x.createdAt).getTime(),
      })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  const grossToday = data.entries
    .filter((e) => e.date === today)
    .reduce((a, e) => a + e.gross, 0);

  return (
    <RegisterClient
      today={today}
      avgPerKm={range14.perKm}
      avgPerHour={range14.perHour}
      costPerKm={costPerKm(s)}
      settings={{
        kmPerLiter: s.kmPerLiter,
        fuelPrice: s.fuelPrice,
        maintenancePerKm: s.maintenancePerKm,
      }}
      items={items}
      grossToday={grossToday}
      hasBaselines={range14.hours >= 3}
      platforms={platforms}
    />
  );
}
