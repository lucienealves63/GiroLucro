import type { Expense, Maintenance, Settings, WorkEntry } from "@/db/schema";
import {
  MAINT_META,
  lastNDays,
  monthOf,
  platformName,
  resolvePlatformMeta,
  weekdayName,
} from "@/lib/format";

/* ---------------------------------- tipos --------------------------------- */

export interface DayStats {
  date: string;
  gross: number;
  hours: number;
  km: number;
  quantity: number; // entregas/corridas
  waitHours: number; // tempo parado em espera
  fuelEst: number; // combustível estimado por km
  fuelActual: number; // combustível registrado
  fuelCost: number; // usado no lucro (depende do modo)
  maintProv: number; // provisão de manutenção por km
  food: number;
  other: number;
  emergency: number; // borracharia + equipamento
  fixedShare: number;
  net: number;
  perHour: number;
  perKm: number;
  perDelivery: number;
}

export interface RangeStats {
  days: DayStats[];
  gross: number;
  hours: number;
  km: number;
  quantity: number;
  waitHours: number;
  fuelCost: number;
  maintProv: number;
  food: number;
  other: number;
  emergency: number;
  fixedShare: number;
  net: number;
  perHour: number;
  perKm: number;
  perDelivery: number;
  fuelActual: number;
}

export interface PlatformStats {
  platform: string;
  gross: number;
  hours: number;
  km: number;
  trips: number;
  quantity: number;
  waitMin: number;
  fuelCost: number;
  maintProv: number;
  fixedAlloc: number;
  net: number;
  perHour: number;
  perKm: number;
  perDelivery: number;
  kmPerDelivery: number;
  perHourNoWait: number; // quanto renderia sem tempo parado
  grossShare: number;
}

export interface MaintStatus {
  type: string;
  label: string;
  hasRecord: boolean;
  kmDone: number;
  cost: number;
  date: string;
  intervalKm: number;
  sinceKm: number;
  remainingKm: number;
  pct: number; // 0..1 do intervalo consumido
  status: "ok" | "atencao" | "urgente" | "vencido" | "none";
}

/* ------------------------------- custos base ------------------------------ */

export function costPerKm(s: Settings): number {
  const fuel = s.kmPerLiter > 0 ? s.fuelPrice / s.kmPerLiter : 0;
  return fuel + s.maintenancePerKm;
}

export function fuelPerKm(s: Settings): number {
  return s.kmPerLiter > 0 ? s.fuelPrice / s.kmPerLiter : 0;
}

export function monthlyFixed(s: Settings): number {
  return s.monthlyRent + s.monthlyPhone + s.monthlyInsurance;
}

export function workDaysPerMonth(s: Settings): number {
  return Math.max(1, Math.round(s.workDaysPerWeek * 4.345));
}

export function dailyFixedShare(s: Settings): number {
  return monthlyFixed(s) / workDaysPerMonth(s);
}

export function dailyGoal(s: Settings): number {
  return s.monthlyGoal / workDaysPerMonth(s);
}

/* ------------------------------ estatísticas ------------------------------ */

export function computeDay(
  date: string,
  entries: WorkEntry[],
  expenses: Expense[],
  s: Settings,
): DayStats {
  const de = entries.filter((e) => e.date === date);
  const dx = expenses.filter((e) => e.date === date);

  const gross = de.reduce((a, e) => a + e.gross, 0);
  const hours = de.reduce((a, e) => a + e.hours, 0);
  const km = de.reduce((a, e) => a + e.km, 0);
  const quantity = de.reduce((a, e) => a + (e.quantity ?? 0), 0);
  const waitHours = de.reduce((a, e) => a + (e.waitMinutes ?? 0), 0) / 60;

  const fuelEst = km * fuelPerKm(s);
  const fuelActual = dx
    .filter((e) => e.type === "combustivel")
    .reduce((a, e) => a + e.amount, 0);
  const fuelCost = s.fuelMode === "actual" ? fuelActual : fuelEst;

  const maintProv = km * s.maintenancePerKm;
  const food = dx.filter((e) => e.type === "alimentacao").reduce((a, e) => a + e.amount, 0);
  const other = dx.filter((e) => e.type === "outro").reduce((a, e) => a + e.amount, 0);
  const emergency = dx
    .filter((e) => e.type === "borracharia" || e.type === "equipamento")
    .reduce((a, e) => a + e.amount, 0);
  const fixedShare = hours > 0 || gross > 0 ? dailyFixedShare(s) : 0;

  const net = gross - fuelCost - maintProv - food - other - emergency - fixedShare;

  return {
    date,
    gross,
    hours,
    km,
    quantity,
    waitHours,
    fuelEst,
    fuelActual,
    fuelCost,
    maintProv,
    food,
    other,
    emergency,
    fixedShare,
    net,
    perHour: hours > 0 ? net / hours : 0,
    perKm: km > 0 ? net / km : 0,
    perDelivery: quantity > 0 ? net / quantity : 0,
  };
}

export function computeRange(
  dates: string[],
  entries: WorkEntry[],
  expenses: Expense[],
  s: Settings,
): RangeStats {
  const days = dates.map((d) => computeDay(d, entries, expenses, s));
  const agg = days.reduce(
    (a, d) => ({
      gross: a.gross + d.gross,
      hours: a.hours + d.hours,
      km: a.km + d.km,
      quantity: a.quantity + d.quantity,
      waitHours: a.waitHours + d.waitHours,
      fuelCost: a.fuelCost + d.fuelCost,
      maintProv: a.maintProv + d.maintProv,
      food: a.food + d.food,
      other: a.other + d.other,
      emergency: a.emergency + d.emergency,
      fixedShare: a.fixedShare + d.fixedShare,
      net: a.net + d.net,
      fuelActual: a.fuelActual + d.fuelActual,
    }),
    {
      gross: 0, hours: 0, km: 0, quantity: 0, waitHours: 0, fuelCost: 0,
      maintProv: 0, food: 0, other: 0, emergency: 0, fixedShare: 0, net: 0,
      fuelActual: 0,
    },
  );
  return {
    days,
    ...agg,
    perHour: agg.hours > 0 ? agg.net / agg.hours : 0,
    perKm: agg.km > 0 ? agg.net / agg.km : 0,
    perDelivery: agg.quantity > 0 ? agg.net / agg.quantity : 0,
  };
}

/* --------------------------- comparativo plataformas ----------------------- */

export function platformBreakdown(
  dates: string[],
  entries: WorkEntry[],
  expenses: Expense[],
  s: Settings,
): PlatformStats[] {
  const range = computeRange(dates, entries, expenses, s);
  const inRange = entries.filter((e) => dates.includes(e.date));
  const byPlatform = new Map<string, WorkEntry[]>();
  for (const e of inRange) {
    const list = byPlatform.get(e.platform) ?? [];
    list.push(e);
    byPlatform.set(e.platform, list);
  }

  const stats: PlatformStats[] = [];
  for (const [platform, list] of byPlatform) {
    const gross = list.reduce((a, e) => a + e.gross, 0);
    const hours = list.reduce((a, e) => a + e.hours, 0);
    const km = list.reduce((a, e) => a + e.km, 0);
    const quantity = list.reduce((a, e) => a + (e.quantity ?? 0), 0);
    const waitMin = list.reduce((a, e) => a + (e.waitMinutes ?? 0), 0);
    const fuelEst = km * fuelPerKm(s);
    let fuelCost: number;
    if (s.fuelMode === "actual" && range.fuelActual > 0) {
      // rateio do combustível real proporcional ao km
      fuelCost = range.km > 0 ? range.fuelActual * (km / range.km) : 0;
    } else {
      fuelCost = fuelEst;
    }
    const maintProv = km * s.maintenancePerKm;
    const fixedAlloc = range.hours > 0 ? range.fixedShare * (hours / range.hours) : 0;
    const net = gross - fuelCost - maintProv - fixedAlloc;
    const activeHours = Math.max(0, hours - waitMin / 60);
    stats.push({
      platform,
      gross,
      hours,
      km,
      trips: list.length,
      quantity,
      waitMin,
      fuelCost,
      maintProv,
      fixedAlloc,
      net,
      perHour: hours > 0 ? net / hours : 0,
      perKm: km > 0 ? net / km : 0,
      perDelivery: quantity > 0 ? net / quantity : 0,
      kmPerDelivery: quantity > 0 ? km / quantity : 0,
      perHourNoWait: activeHours > 0.05 ? net / activeHours : net,
      grossShare: range.gross > 0 ? gross / range.gross : 0,
    });
  }
  return stats.sort((a, b) => b.gross - a.gross);
}

/* ------------------------------- manutenção -------------------------------- */

export function currentOdometer(
  s: Settings,
  entries: WorkEntry[],
  expenses: Expense[],
): number {
  const totalKm = entries.reduce((a, e) => a + e.km, 0);
  const maxExpenseOdo = expenses.reduce(
    (a, e) => Math.max(a, e.odometer ?? 0),
    0,
  );
  return Math.max(s.initialOdometer + totalKm, maxExpenseOdo);
}

export function maintenanceStatuses(
  maints: Maintenance[],
  currentKm: number,
): MaintStatus[] {
  const types = Object.keys(MAINT_META);
  return types.map((type) => {
    const records = maints
      .filter((m) => m.type === type)
      .sort((a, b) => b.kmDone - a.kmDone);
    const latest = records[0];
    if (!latest || latest.intervalKm <= 0) {
      return {
        type,
        label: MAINT_META[type].label,
        hasRecord: false,
        kmDone: latest?.kmDone ?? 0,
        cost: latest?.cost ?? 0,
        date: latest?.date ?? "",
        intervalKm: latest?.intervalKm ?? MAINT_META[type].defaultInterval,
        sinceKm: 0,
        remainingKm: 0,
        pct: 0,
        status: "none" as const,
      };
    }
    const sinceKm = Math.max(0, currentKm - latest.kmDone);
    const remainingKm = latest.intervalKm - sinceKm;
    const pct = Math.min(1.2, sinceKm / latest.intervalKm);
    let status: MaintStatus["status"] = "ok";
    if (remainingKm < 0) status = "vencido";
    else if (remainingKm < latest.intervalKm * 0.12) status = "urgente";
    else if (remainingKm < latest.intervalKm * 0.35) status = "atencao";
    return {
      type,
      label: MAINT_META[type].label,
      hasRecord: true,
      kmDone: latest.kmDone,
      cost: latest.cost,
      date: latest.date,
      intervalKm: latest.intervalKm,
      sinceKm,
      remainingKm,
      pct,
      status,
    };
  });
}

/* -------------------------------- metas/reserva ---------------------------- */

export function monthProgress(
  today: string,
  entries: WorkEntry[],
  expenses: Expense[],
  s: Settings,
) {
  const thisMonth = monthOf(today);
  const dates = Array.from(
    new Set([
      ...entries.filter((e) => monthOf(e.date) === thisMonth).map((e) => e.date),
      ...expenses.filter((e) => monthOf(e.date) === thisMonth).map((e) => e.date),
    ]),
  ).sort();
  const range = computeRange(dates, entries, expenses, s);
  const goal = dailyGoal(s);
  const hitDays = range.days.filter((d) => d.gross > 0 && d.net >= goal).length;
  const workedDays = range.days.filter((d) => d.gross > 0).length;
  return { range, hitDays, workedDays, dates, goal };
}

export interface Insight {
  tone: "good" | "warn" | "info";
  text: string;
}

export function buildInsights(
  today: string,
  entries: WorkEntry[],
  expenses: Expense[],
  s: Settings,
): Insight[] {
  const out: Insight[] = [];
  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const week = computeRange(lastNDays(today, 7), entries, expenses, s);
  const prevWeek = computeRange(
    lastNDays(today, 14).slice(0, 7),
    entries,
    expenses,
    s,
  );

  // semana vs semana
  if (week.hours > 0 && prevWeek.net !== 0 && prevWeek.hours > 0) {
    const delta = ((week.net - prevWeek.net) / Math.abs(prevWeek.net)) * 100;
    const dir = delta >= 0 ? "subiu" : "caiu";
    out.push({
      tone: delta >= 0 ? "good" : "warn",
      text: `Seu lucro líquido ${dir} ${Math.abs(delta).toFixed(0)}% em relação à semana passada (${fmt(week.net)} vs ${fmt(prevWeek.net)}).`,
    });
  }

  // plataformas
  const plats = platformBreakdown(lastNDays(today, 7), entries, expenses, s).filter(
    (p) => p.hours >= 1.5,
  );
  if (plats.length >= 2) {
    const best = [...plats].sort((a, b) => b.perHour - a.perHour)[0];
    const worst = [...plats].sort((a, b) => a.perHour - b.perHour)[0];
    if (best.perHour > 0 && worst.perHour > 0 && best.platform !== worst.platform) {
      const diff = ((best.perHour - worst.perHour) / worst.perHour) * 100;
      if (diff >= 5) {
        out.push({
          tone: "good",
          text: `Na semana, o ${platformName(best.platform)} rendeu ${diff.toFixed(0)}% mais por hora líquida que o ${platformName(worst.platform)} (${fmt(best.perHour)}/h vs ${fmt(worst.perHour)}/h).`,
        });
      }
    }
    const top = [...plats].sort((a, b) => b.grossShare - a.grossShare)[0];
    if (top && top.grossShare >= 0.6) {
      out.push({
        tone: "info",
        text: `${platformName(top.platform)} concentrou ${(top.grossShare * 100).toFixed(0)}% do seu faturamento. Dependência alta de um app só é risco — vale testar horários no outro.`,
      });
    }
    // retorno vazio: km por entrega muito acima do menor
    const deliveries = plats.filter(
      (p) => resolvePlatformMeta(p.platform).category === "delivery" && p.quantity >= 5,
    );
    if (deliveries.length >= 2) {
      const heavy = [...deliveries].sort((a, b) => b.kmPerDelivery - a.kmPerDelivery)[0];
      const light = [...deliveries].sort((a, b) => a.kmPerDelivery - b.kmPerDelivery)[0];
      if (light.kmPerDelivery > 0 && heavy.kmPerDelivery > light.kmPerDelivery * 1.25) {
        out.push({
          tone: "warn",
          text: `O ${platformName(heavy.platform)} te joga mais longe: ${heavy.kmPerDelivery.toFixed(1).replace(".", ",")} km por entrega vs ${light.kmPerDelivery.toFixed(1).replace(".", ",")} km no ${platformName(light.platform)}. Retorno vazio longo corrói lucro — avalie rotas que te afastam das zonas de pedido.`,
        });
      }
    }
  }

  // tempo mofando em restaurante/espera
  if (plats.length >= 1) {
    const withWait = plats
      .filter((p) => p.waitMin >= 30 && p.hours > 0)
      .sort((a, b) => b.waitMin - a.waitMin)[0];
    if (withWait && withWait.perHourNoWait > withWait.perHour * 1.08) {
      const share = withWait.waitMin / 60 / withWait.hours;
      out.push({
        tone: "warn",
        text: `Você passou ${Math.round(withWait.waitMin)} min (${(share * 100).toFixed(0)}% do tempo) esperando pedido no ${platformName(withWait.platform)} na semana. Sem essa espera, seu ganho subiria de ${fmt(withWait.perHour)}/h para ${fmt(withWait.perHourNoWait)}/h.`,
      });
    }
    // destaque por entrega para apps de comida
    const bestDelivery = plats
      .filter((p) => resolvePlatformMeta(p.platform).category === "delivery" && p.quantity >= 5)
      .sort((a, b) => b.perDelivery - a.perDelivery)[0];
    if (bestDelivery) {
      out.push({
        tone: "info",
        text: `Cada entrega do ${platformName(bestDelivery.platform)} deixou ${fmt(bestDelivery.perDelivery)} líquidos (${bestDelivery.quantity} entregas na semana). Meta de volume sai disso, não do bruto.`,
      });
    }
  }

  // melhor dia da semana
  const byWeekday = new Map<string, { net: number; days: number }>();
  for (const d of lastNDays(today, 28)) {
    const st = computeDayMemo(d, entries, expenses, s);
    if (st.gross <= 0) continue;
    const w = weekdayName(d);
    const cur = byWeekday.get(w) ?? { net: 0, days: 0 };
    cur.net += st.net;
    cur.days += 1;
    byWeekday.set(w, cur);
  }
  const weekdayAvg = [...byWeekday.entries()]
    .map(([w, v]) => ({ w, avg: v.net / v.days }))
    .filter((x) => x.avg > 0)
    .sort((a, b) => b.avg - a.avg);
  if (weekdayAvg.length >= 2) {
    const best = weekdayAvg[0];
    out.push({
      tone: "info",
      text: `${best.w[0].toUpperCase() + best.w.slice(1)} é seu dia mais rentável: média de ${fmt(best.avg)} líquidos nos últimos 28 dias.`,
    });
  }

  // melhor período
  const byPeriod = new Map<string, { net: number; hours: number }>();
  for (const e of entries.filter((x) => lastNDays(today, 28).includes(x.date))) {
    const cur = byPeriod.get(e.period) ?? { net: 0, hours: 0 };
    const share = e.km * (fuelPerKm(s) + s.maintenancePerKm);
    cur.net += e.gross - share;
    cur.hours += e.hours;
    byPeriod.set(e.period, cur);
  }
  const periodOrder = ["madrugada", "manha", "tarde", "noite"] as const;
  const periodNames: Record<string, string> = {
    madrugada: "Madrugada", manha: "Manhã", tarde: "Tarde", noite: "Noite",
  };
  const bestPeriod = [...byPeriod.entries()]
    .filter(([, v]) => v.hours >= 2)
    .map(([p, v]) => ({ p, perHour: v.net / v.hours }))
    .filter((x) => x.perHour > 0)
    .sort((a, b) => b.perHour - a.perHour)[0];
  if (bestPeriod && byPeriod.size >= 2) {
    out.push({
      tone: "info",
      text: `O período da ${periodNames[bestPeriod.p].toLowerCase()} é o que mais paga por hora: ${fmt(bestPeriod.perHour)}/h líquido. Ordene: ${periodOrder
        .filter((p) => byPeriod.has(p))
        .map((p) => periodNames[p])
        .join(" › ")}.`,
    });
  }

  return out.slice(0, 6);
}

const dayCache = new Map<string, DayStats>();
function computeDayMemo(
  d: string,
  entries: WorkEntry[],
  expenses: Expense[],
  s: Settings,
): DayStats {
  const hit = dayCache.get(d);
  if (hit) return hit;
  const st = computeDay(d, entries, expenses, s);
  if (dayCache.size > 60) dayCache.clear();
  dayCache.set(d, st);
  return st;
}

/* ------------------------------ vale a pena? ------------------------------- */

export function rideVerdict(
  offer: number,
  tripKm: number,
  minutes: number,
  s: Pick<Settings, "kmPerLiter" | "fuelPrice" | "maintenancePerKm">,
  avgPerKm: number,
  avgPerHour: number,
) {
  const fuel = s.kmPerLiter > 0 ? s.fuelPrice / s.kmPerLiter : 0;
  const directCost = tripKm * (fuel + s.maintenancePerKm);
  const net = offer - directCost;
  const perKm = tripKm > 0 ? net / tripKm : 0;
  const perHour = minutes > 0 ? (net / minutes) * 60 : 0;
  let score = 0;
  if (avgPerKm > 0 && perKm >= avgPerKm) score++;
  if (avgPerKm <= 0 && perKm > 0) score++;
  const refHour = avgPerHour > 0 ? avgPerHour : 0;
  if (minutes <= 0 || refHour <= 0 || perHour >= refHour) score++;
  const verdict =
    score >= 2 ? "boa" : score === 1 ? "mediana" : "ruim";
  return { net, perKm, perHour, verdict };
}
