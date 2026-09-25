import { PostosClient, type FillUpVM, type StationVM } from "@/components/postos";
import { requireUser } from "@/lib/auth";
import {
  fuelFillUps,
  fuelVolumeLine,
  stationStats,
  type StationStats,
} from "@/lib/fuel";
import { getAppData } from "@/lib/data";
import { dayMonth, lastNDays, todayStr } from "@/lib/format";

export const dynamic = "force-dynamic";

function toVM(s: StationStats): StationVM {
  return {
    key: s.key || "__sem_posto__",
    label: s.label,
    fillUps: s.fillUps,
    liters: s.liters,
    spent: s.spent,
    pricePerLiter: s.pricePerLiter,
    kmPerLiter: s.kmPerLiter,
    costPerKm: s.costPerKm,
    measuredSegments: s.measuredSegments,
    measuredKm: s.measuredKm,
    wasted: s.wasted,
    monthlyImpact: s.monthlyImpact,
    rank: s.rank,
    gapPct: s.gapPct,
    lastDate: s.lastDate,
  };
}

export default async function PostosPage() {
  const user = await requireUser({ needsAccess: true });
  const data = await getAppData(user.id);
  const today = todayStr();

  const build = (days: number) => {
    const r = stationStats(data.expenses, new Set(lastNDays(today, days)), days);
    return {
      days,
      stations: r.stations.map(toVM),
      best: r.best ? toVM(r.best) : null,
      worst: r.worst ? toVM(r.worst) : null,
      rankedBy: r.rankedBy,
      totalWasted: r.totalWasted,
      totalLiters: r.totalLiters,
      totalSpent: r.totalSpent,
      overallKmPerLiter: r.overallKmPerLiter,
      overallCostPerKm: r.overallCostPerKm,
      measuredStations: r.measuredStations,
      unlabeledSpent: r.unlabeledSpent,
    };
  };

  const fillUps: FillUpVM[] = fuelFillUps(data.expenses)
    .slice(-30)
    .reverse()
    .map((f) => ({
      id: f.id,
      dateLabel: dayMonth(f.date),
      amount: f.amount,
      litersLine: fuelVolumeLine(f),
      note: f.note ?? null,
      station: f.station?.trim() || null,
    }));

  return (
    <PostosClient
      week={build(7)}
      month={build(30)}
      quarter={build(90)}
      fillUps={fillUps}
      kmPerLiterConfig={data.settings.kmPerLiter}
      fuelPriceConfig={data.settings.fuelPrice}
      hasFuel={data.expenses.some((e) => e.type === "combustivel")}
    />
  );
}
