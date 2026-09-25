import type { Expense, Settings } from "@/db/schema";
import { brl } from "@/lib/format";

/**
 * Combustível por posto.
 *
 * A pergunta que este módulo responde: **em qual posto sobra mais lucro
 * líquido?** O lucro do dia cai 1:1 com o que se paga no combustível, então o
 * posto vencedor é o de menor **custo por km rodado**:
 *
 *   R$/km = R$/litro ÷ km/l
 *
 * - `R$/litro` vem do preço pago (valor ÷ litros do abastecimento).
 * - `km/l` vem do odômetro: a distância entre dois abastecimentos seguidos
 *   dividida pelos litros do abastecimento **anterior** (tanque cheio →
 *   tanque cheio, a medição clássica de consumo). Por isso o consumo medido é
 *   atribuído ao posto onde aquela carga foi comprada.
 *
 * Quando não há odômetro suficiente para medir o consumo, o ranking usa só o
 * preço do litro (`rankedBy = "price_liter"`) e avisa que falta odômetro.
 */

/* ------------------------------ normalização ------------------------------ */

/** Nome do posto como digitado (apara espaços e limita o tamanho). */
export function normalizeStationName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.replace(/\s+/g, " ").trim().slice(0, 60);
  return clean.length >= 2 ? clean : null;
}

/**
 * Chave de comparação entre postos: minúsculas e sem acento, para que
 * "Posto Shell" e "posto shell " sejam o mesmo posto no ranking.
 */
export function stationKey(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* --------------------------------- tipos ---------------------------------- */

export type FuelExpense = Pick<
  Expense,
  "id" | "type" | "date" | "amount" | "odometer" | "station" | "liters" | "note"
>;

export interface StationStats {
  key: string;
  /** Nome para exibição (o mais recente digitado para aquele posto). */
  label: string;
  fillUps: number;
  liters: number;
  spent: number;
  /** R$ por litro pago no posto (média ponderada). null = sem litros válidos. */
  pricePerLiter: number | null;
  /** km/l medido pelo odômetro. null = ainda sem medição. */
  kmPerLiter: number | null;
  /** R$/km — a métrica do lucro líquido. null = sem preço ou sem consumo. */
  costPerKm: number | null;
  /** Trechos de odômetro usados na medição e km somados neles. */
  measuredSegments: number;
  measuredKm: number;
  firstDate: string;
  lastDate: string;
  /** Quanto teria sobrado a mais se tudo fosse comprado no posto líder. */
  wasted: number;
  /** Projeção mensal dessa diferença (na janela analisada). */
  monthlyImpact: number;
  /** Posição no ranking (1 = mais lucro). */
  rank: number;
  /** Quanto (em %) está acima do posto líder. null = sem base de comparação. */
  gapPct: number | null;
}

export interface StationRanking {
  days: number;
  stations: StationStats[];
  /** Posto que deixa mais lucro líquido (rank 1). */
  best: StationStats | null;
  /** Posto mais caro entre os ranqueados (null se há um posto só). */
  worst: StationStats | null;
  /** "km_liter" quando há consumo medido; "price_liter" quando só há preço. */
  rankedBy: "km_liter" | "price_liter";
  /** Soma de `wasted`: quanto a escolha do posto custou na janela. */
  totalWasted: number;
  totalLiters: number;
  totalSpent: number;
  /** km/l geral do veículo na janela (independe do posto). */
  overallKmPerLiter: number | null;
  /** R$/km geral na janela. */
  overallCostPerKm: number | null;
  /** Quantos postos têm odômetro suficiente para medir consumo. */
  measuredStations: number;
  /** Total gasto em abastecimentos sem posto informado. */
  unlabeledSpent: number;
}

/* ------------------------------ abastecimentos ---------------------------- */

/** Só os gastos de combustível, em ordem cronológica. */
export function fuelFillUps(expenses: FuelExpense[]): FuelExpense[] {
  return expenses
    .filter((e) => e.type === "combustivel")
    .slice()
    .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));
}

/** Faixa de R$/litro considerada válida (fora disso, litros digitados errados). */
const MIN_PRICE_PER_LITER = 1;
const MAX_PRICE_PER_LITER = 30;

export function pricePerLiterOf(f: FuelExpense): number | null {
  if (!f.liters || f.liters <= 0 || f.amount <= 0) return null;
  const price = f.amount / f.liters;
  return price >= MIN_PRICE_PER_LITER && price <= MAX_PRICE_PER_LITER ? price : null;
}

/**
 * Consome o odômetro em ordem e devolve, para cada abastecimento, quantos km
 * rodaram com aquela carga (atribuição tanque cheio → tanque cheio).
 */
function kmByFillUp(fillUps: FuelExpense[]): Map<number, number> {
  const km = new Map<number, number>();
  const ordered = fillUps.filter((f) => typeof f.odometer === "number");
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    const delta = (cur.odometer ?? 0) - (prev.odometer ?? 0);
    // delta <= 0: odômetro trocado/voltado — trecho ignorado
    if (delta > 0 && prev.liters && prev.liters > 0) km.set(prev.id, delta);
  }
  return km;
}

/* --------------------------------- ranking -------------------------------- */

type Acc = {
  label: string;
  fillUps: number;
  liters: number;
  spent: number;
  measuredSegments: number;
  measuredKm: number;
  measuredLiters: number;
  firstDate: string;
  lastDate: string;
};

/**
 * Ranking de postos pelo lucro líquido que cada um deixa.
 *
 * @param dates janela de datas (yyyy-MM-dd); null = histórico inteiro
 */
export function stationStats(
  expenses: FuelExpense[],
  dates: Set<string> | null,
  days: number,
): StationRanking {
  const all = fuelFillUps(expenses);
  // medição calculada sobre o histórico todo: o trecho que começa antes da
  // janela continua sendo consumo daquele posto
  const kmByFill = kmByFillUp(all);
  const inWindow = (e: FuelExpense) => (dates ? dates.has(e.date) : true);

  const byStation = new Map<string, Acc>();
  let totalLiters = 0;
  let totalSpent = 0;
  let unlabeledSpent = 0;
  let overallKm = 0;
  let overallLiters = 0;

  for (const f of all) {
    if (!inWindow(f)) continue;
    const key = stationKey(f.station);
    if (!key) unlabeledSpent += f.amount;
    const acc: Acc = byStation.get(key) ?? {
      label: "Sem posto informado",
      fillUps: 0,
      liters: 0,
      spent: 0,
      measuredSegments: 0,
      measuredKm: 0,
      measuredLiters: 0,
      firstDate: f.date,
      lastDate: f.date,
    };
    acc.fillUps += 1;
    acc.spent += f.amount;
    if (f.liters && f.liters > 0) acc.liters += f.liters;
    if (f.station?.trim()) acc.label = f.station.trim();
    if (f.date < acc.firstDate) acc.firstDate = f.date;
    if (f.date > acc.lastDate) acc.lastDate = f.date;

    const km = kmByFill.get(f.id);
    if (km && f.liters && f.liters > 0) {
      acc.measuredSegments += 1;
      acc.measuredKm += km;
      acc.measuredLiters += f.liters;
      overallKm += km;
      overallLiters += f.liters;
    }

    byStation.set(key, acc);
    totalLiters += f.liters ?? 0;
    totalSpent += f.amount;
  }

  const stations: StationStats[] = [...byStation.entries()].map(([key, acc]) => {
    const rawPrice = acc.liters > 0 ? acc.spent / acc.liters : null;
    const pricePerLiter =
      rawPrice !== null &&
      rawPrice >= MIN_PRICE_PER_LITER &&
      rawPrice <= MAX_PRICE_PER_LITER
        ? rawPrice
        : null;
    const kmPerLiter =
      acc.measuredLiters > 0 ? acc.measuredKm / acc.measuredLiters : null;
    const costPerKm =
      pricePerLiter !== null && kmPerLiter !== null && kmPerLiter > 0
        ? pricePerLiter / kmPerLiter
        : null;
    return {
      key,
      label: acc.label,
      fillUps: acc.fillUps,
      liters: acc.liters,
      spent: acc.spent,
      pricePerLiter,
      kmPerLiter,
      costPerKm,
      measuredSegments: acc.measuredSegments,
      measuredKm: acc.measuredKm,
      firstDate: acc.firstDate,
      lastDate: acc.lastDate,
      wasted: 0,
      monthlyImpact: 0,
      rank: 0,
      gapPct: null,
    };
  });

  // "ranqueável" = tem custo/km (ideal) ou ao menos o preço do litro
  const isRankable = (x: StationStats) =>
    x.costPerKm !== null || x.pricePerLiter !== null;
  const withCost = stations.filter((x) => x.costPerKm !== null);
  const withPriceOnly = stations.filter(
    (x) => x.costPerKm === null && x.pricePerLiter !== null,
  );
  // sem consumo medido em 2+ postos, a comparação possível é o preço do litro
  const rankedBy: StationRanking["rankedBy"] =
    withCost.length < 2 && withPriceOnly.length >= 2 ? "price_liter" : "km_liter";

  /**
   * Métrica de comparação — menor = mais lucro líquido:
   * - ranking por custo/km: o próprio R$/km (quem só tem preço fica sem base);
   * - ranking por preço: o R$/litro (custo/km também serve de desempate).
   */
  const compareValue = (x: StationStats): number => {
    if (rankedBy === "price_liter") return x.pricePerLiter ?? x.costPerKm ?? Number.NaN;
    return x.costPerKm ?? Number.NaN;
  };
  stations.sort((a, b) => {
    const ma = compareValue(a);
    const mb = compareValue(b);
    if (Number.isNaN(ma) && Number.isNaN(mb)) return b.spent - a.spent;
    if (Number.isNaN(ma)) return 1;
    if (Number.isNaN(mb)) return -1;
    if (ma !== mb) return ma - mb;
    return b.spent - a.spent;
  });

  const leader = stations.find(isRankable);
  const leaderValue = leader ? compareValue(leader) : Number.NaN;
  const windowDays = Math.max(1, days);

  stations.forEach((x, i) => {
    x.rank = i + 1;
    const v = compareValue(x);
    if (!leader || Number.isNaN(leaderValue) || leaderValue <= 0 || x.key === leader.key) {
      return;
    }
    if (Number.isNaN(v)) return; // sem base de comparação
    const extraPerUnit = v - leaderValue;
    // por preço: a diferença vale para cada litro comprado no posto;
    // por custo/km: para cada km medidos com o combustível dele
    const units = rankedBy === "price_liter" ? x.liters : x.measuredKm;
    x.wasted = Math.max(0, extraPerUnit * units);
    x.gapPct = extraPerUnit / leaderValue;
    x.monthlyImpact = (x.wasted / windowDays) * 30;
  });

  const ranked = stations.filter(isRankable);
  const totalWasted = stations.reduce((a, x) => a + x.wasted, 0);
  const overallKmPerLiter = overallLiters > 0 ? overallKm / overallLiters : null;
  const overallPrice = totalLiters > 0 ? totalSpent / totalLiters : null;
  const overallCostPerKm =
    overallKmPerLiter !== null && overallKmPerLiter > 0 && overallPrice !== null
      ? overallPrice / overallKmPerLiter
      : null;

  return {
    days: windowDays,
    stations,
    best: ranked[0] ?? null,
    worst: ranked.length >= 2 ? (ranked[ranked.length - 1] ?? null) : null,
    rankedBy,
    totalWasted,
    totalLiters,
    totalSpent,
    overallKmPerLiter,
    overallCostPerKm,
    measuredStations: stations.filter((x) => x.kmPerLiter !== null).length,
    unlabeledSpent,
  };
}

/** Atalho: ranking dos últimos N dias (lista de datas). */
export function stationRanking(
  expenses: FuelExpense[],
  dates: string[],
): StationRanking {
  return stationStats(expenses, new Set(dates), dates.length || 1);
}

/* --------------------------------- textos --------------------------------- */

const num = (v: number, d = 1) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Volume e preço do abastecimento ("7,2 L · R$ 5,56/L"). */
export function fuelVolumeLine(f: FuelExpense): string {
  if (!f.liters || f.liters <= 0) return "";
  const parts = [`${num(f.liters, 1)} L`];
  const price = pricePerLiterOf(f);
  if (price !== null) parts.push(`${brl(price)}/L`);
  return parts.join(" · ");
}

/** Descrição curta de um abastecimento para listas ("Posto X · 7,2 L · R$ 5,56/L"). */
export function fuelLine(f: FuelExpense): string {
  const parts: string[] = [];
  if (f.station?.trim()) parts.push(f.station.trim());
  const volume = fuelVolumeLine(f);
  if (volume) parts.push(volume);
  return parts.join(" · ");
}

export interface FuelStationInsight {
  tone: "good" | "warn" | "info";
  text: string;
}

/**
 * Insight do comparativo de postos para o dashboard/raio-X.
 * Devolve no máximo 2 linhas e nada quando ainda não dá para comparar.
 */
export function stationInsights(
  expenses: FuelExpense[],
  dates: string[],
  s: Pick<Settings, "kmPerLiter"> | null,
): FuelStationInsight[] {
  const r = stationRanking(expenses, dates);
  const ranked = r.stations.filter((x) => x.costPerKm !== null || x.pricePerLiter !== null);
  if (ranked.length < 2) return [];

  const best = ranked[0]!;
  const worst = ranked[ranked.length - 1]!;
  const out: FuelStationInsight[] = [];

  if (best.costPerKm !== null && worst.costPerKm !== null && best.key !== worst.key) {
    const diffPct = ((worst.costPerKm - best.costPerKm) / best.costPerKm) * 100;
    out.push({
      tone: "good",
      text: `Abastecer no ${best.label} custa ${brl(best.costPerKm)} por km contra ${brl(worst.costPerKm)} no ${worst.label} (${diffPct.toFixed(0)}% mais caro). Nos últimos ${r.days} dias isso tirou ${brl(worst.wasted)} do seu lucro — abastecendo só no ${best.label} esse valor ficaria no bolso.`,
    });
  } else if (
    best.pricePerLiter !== null &&
    worst.pricePerLiter !== null &&
    best.key !== worst.key
  ) {
    out.push({
      tone: "info",
      text: `O litro mais barato foi no ${best.label} (${brl(best.pricePerLiter)}/L contra ${brl(worst.pricePerLiter)}/L no ${worst.label}). Registre o odômetro no abastecimento para eu medir o km/l de cada posto e dizer qual deixa mais lucro líquido.`,
    });
  }

  if (r.overallKmPerLiter !== null && s && s.kmPerLiter > 0) {
    const delta = r.overallKmPerLiter - s.kmPerLiter;
    if (Math.abs(delta) / s.kmPerLiter >= 0.08) {
      out.push({
        tone: delta < 0 ? "warn" : "good",
        text: `Seu consumo medido é ${num(r.overallKmPerLiter)} km/l — ${delta < 0 ? "abaixo" : "acima"} dos ${num(s.kmPerLiter)} km/l configurados${delta < 0 ? " (o lucro estimado está maior que o real)" : " (você gasta menos combustível do que o app estima)"}. Atualize em Configurações.`,
      });
    }
  }

  return out.slice(0, 2);
}
