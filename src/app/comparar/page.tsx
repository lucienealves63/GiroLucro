import { CompareClient, type ComparePeriodVM, type SettlementVM } from "@/components/compare";
import { requireUser } from "@/lib/auth";
import { buildInsights, computeRange, platformBreakdown } from "@/lib/calculations";
import { getAppData } from "@/lib/data";
import { lastNDays, todayStr } from "@/lib/format";

export const dynamic = "force-dynamic";

function buildPeriod(
  days: number,
  today: string,
  data: Awaited<ReturnType<typeof getAppData>>,
): ComparePeriodVM {
  const dates = lastNDays(today, days);
  const range = computeRange(dates, data.entries, data.expenses, data.settings);
  const platforms = platformBreakdown(dates, data.entries, data.expenses, data.settings);
  return {
    gross: range.gross,
    net: range.net,
    hours: range.hours,
    km: range.km,
    perHour: range.perHour,
    perKm: range.perKm,
    platforms: platforms.map((p) => ({
      platform: p.platform,
      gross: p.gross,
      hours: p.hours,
      km: p.km,
      trips: p.trips,
      quantity: p.quantity,
      waitMin: p.waitMin,
      net: p.net,
      perHour: p.perHour,
      perKm: p.perKm,
      perDelivery: p.perDelivery,
      kmPerDelivery: p.kmPerDelivery,
      perHourNoWait: p.perHourNoWait,
      grossShare: p.grossShare,
    })),
  };
}

export default async function CompararPage() {
  const user = await requireUser({ needsAccess: true });
  const data = await getAppData(user.id);
  const today = todayStr();

  const week = buildPeriod(7, today, data);
  const month = buildPeriod(30, today, data);

  // repasses: pendente total x recebido nos últimos 30 dias, por plataforma
  const dates30 = new Set(lastNDays(today, 30));
  const settleMap = new Map<string, SettlementVM>();
  for (const e of data.entries) {
    const cur = settleMap.get(e.platform) ?? {
      platform: e.platform,
      pending: 0,
      received30: 0,
    };
    if (e.settled) {
      if (dates30.has(e.date)) cur.received30 += e.gross;
    } else {
      cur.pending += e.gross;
    }
    settleMap.set(e.platform, cur);
  }
  const settlements = [...settleMap.values()]
    .filter((s) => s.pending > 0 || s.received30 > 0)
    .sort((a, b) => b.pending - a.pending);
  const totalPending = settlements.reduce((a, s) => a + s.pending, 0);

  const insights = buildInsights(today, data.entries, data.expenses, data.settings).filter(
    (i) => i.text !== "",
  );

  return (
    <CompareClient
      week={week}
      month={month}
      insights={insights}
      settlements={settlements}
      totalPending={totalPending}
      hasData={data.entries.length > 0}
    />
  );
}
