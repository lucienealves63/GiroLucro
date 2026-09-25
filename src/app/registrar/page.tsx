import { RegisterClient, type RegisterItem } from "@/components/register";
import { requireUser } from "@/lib/auth";
import { computeRange, costPerKm } from "@/lib/calculations";
import { getAppData } from "@/lib/data";
import { fuelLine, stationStats } from "@/lib/fuel";
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
      .map((x) => {
        const fuel = x.type === "combustivel" ? fuelLine(x) : "";
        return {
          id: x.id,
          kind: "expense" as const,
          label: EXPENSE_META[x.type]?.label ?? "Gasto",
          sub: [fuel, x.note].filter(Boolean).join(" · "),
          amount: x.amount,
          positive: false,
          platform: x.type,
          when: timeAgo(x.date, today),
          createdAt: new Date(x.createdAt).getTime(),
        };
      }),
  ].sort((a, b) => b.createdAt - a.createdAt);

  const grossToday = data.entries
    .filter((e) => e.date === today)
    .reduce((a, e) => a + e.gross, 0);

  // postos já usados (atalho no formulário) + líder do ranking de 30 dias
  const byStation = new Map<string, { label: string; uses: number; lastUsed: string }>();
  for (const x of data.expenses) {
    if (x.type !== "combustivel" || !x.station?.trim()) continue;
    const label = x.station.trim();
    const key = label.toLowerCase();
    const cur = byStation.get(key);
    if (!cur) {
      byStation.set(key, { label, uses: 1, lastUsed: x.date });
      continue;
    }
    cur.uses += 1;
    if (x.date >= cur.lastUsed) {
      cur.lastUsed = x.date;
      cur.label = label;
    }
  }
  const stations = [...byStation.values()]
    .sort((a, b) => b.uses - a.uses || (a.lastUsed < b.lastUsed ? 1 : -1))
    .map((v, i) => ({ key: `st-${i}`, label: v.label, uses: v.uses, lastUsed: v.lastUsed }));

  const ranking30 = stationStats(data.expenses, new Set(lastNDays(today, 30)), 30);
  const leader = ranking30.best;
  const bestStation =
    leader && ranking30.stations.length >= 2
      ? {
          label: leader.label,
          costPerKm: leader.costPerKm,
          pricePerLiter: leader.pricePerLiter,
        }
      : null;

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
      stations={stations}
      bestStation={bestStation}
    />
  );
}
