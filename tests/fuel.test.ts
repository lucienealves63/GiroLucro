import {
  fuelFillUps,
  fuelLine,
  normalizeStationName,
  pricePerLiterOf,
  stationInsights,
  stationKey,
  stationRanking,
  stationStats,
  type FuelExpense,
} from "@/lib/fuel";
import { lastNDays } from "@/lib/format";

const TODAY = "2026-09-25";

let seq = 0;
/** Abastecimento de teste (id sequencial para a ordem cronológica ficar estável). */
function fill(
  date: string,
  amount: number,
  station: string | null,
  liters: number | null,
  odometer: number | null,
): FuelExpense {
  seq += 1;
  return {
    id: seq,
    type: "combustivel",
    date,
    amount,
    station,
    liters,
    odometer,
    note: null,
  };
}

/** Gasto que não é combustível — precisa ser ignorado pelo ranking. */
function food(date: string, amount: number): FuelExpense {
  seq += 1;
  return {
    id: seq,
    type: "alimentacao",
    date,
    amount,
    station: null,
    liters: null,
    odometer: null,
    note: null,
  };
}

describe("normalização do posto", () => {
  it("agrava grafias diferentes no mesmo posto", () => {
    expect(stationKey("Posto Shell")).toBe(stationKey("  posto   SHELL "));
    expect(stationKey("Posto Shell")).toBe(stationKey("posto shéll".replace("é", "e")));
    expect(stationKey("Ipiranga")).not.toBe(stationKey("Shell"));
  });

  it("aceita nome com 2+ caracteres e recusa vazio/curto", () => {
    expect(normalizeStationName("  Shell   Centro ")).toBe("Shell Centro");
    expect(normalizeStationName("a")).toBeNull();
    expect(normalizeStationName("   ")).toBeNull();
    expect(normalizeStationName(42)).toBeNull();
    expect(normalizeStationName(undefined)).toBeNull();
  });

  it("calcula R$/litro e descarta litros absurdos", () => {
    expect(pricePerLiterOf(fill(TODAY, 40, "Shell", 7.2, null))).toBeCloseTo(5.5556, 3);
    expect(pricePerLiterOf(fill(TODAY, 40, "Shell", null, null))).toBeNull();
    // 40 / 80 = 0,50 → fora da faixa plausível, trata como litros digitados errados
    expect(pricePerLiterOf(fill(TODAY, 40, "Shell", 80, null))).toBeNull();
  });
});

describe("ranking de postos pelo lucro líquido", () => {
  /**
   * Cenário: dois postos com o mesmo consumo do veículo (35 km/l), mas preços
   * diferentes. O mais barato tem que vencer.
   */
  const mesmoConsumo: FuelExpense[] = [
    fill("2026-09-10", 35, "Posto Barato", 6.3, 12000), // 220 km → 34,9 km/l
    fill("2026-09-14", 40, "Posto Caro", 6.7, 12220), // 230 km → 34,3 km/l
    fill("2026-09-18", 36, "Posto Barato", 6.5, 12450), // 210 km → 32,3 km/l
    fill("2026-09-22", 42, "Posto Caro", 7.0, 12660),
    food("2026-09-22", 25),
  ];

  it("ranqueia por custo por km e aponta o campeão", () => {
    const r = stationStats(mesmoConsumo, new Set(lastNDays(TODAY, 30)), 30);

    expect(r.rankedBy).toBe("km_liter");
    expect(r.stations).toHaveLength(2);
    expect(r.best?.label).toBe("Posto Barato");
    expect(r.worst?.label).toBe("Posto Caro");

    const barato = r.stations[0]!;
    const caro = r.stations[1]!;
    expect(barato.rank).toBe(1);
    expect(caro.rank).toBe(2);
    // R$/litro: 71/12,8 = 5,55 no barato; 82/13,7 = 5,99 no caro
    expect(barato.pricePerLiter).toBeCloseTo(5.547, 2);
    expect(caro.pricePerLiter).toBeCloseTo(5.985, 2);
    // consumo medido por posto
    expect(barato.kmPerLiter).toBeCloseTo((220 + 210) / (6.3 + 6.5), 5);
    expect(caro.kmPerLiter).toBeCloseTo(230 / 6.7, 5);
    // o lucro: custo por km menor no barato
    expect(barato.costPerKm!).toBeLessThan(caro.costPerKm!);
    expect(caro.gapPct!).toBeGreaterThan(0);
    expect(caro.wasted).toBeGreaterThan(0);
    expect(barato.wasted).toBe(0);
    // projeção mensal da diferença
    expect(caro.monthlyImpact).toBeCloseTo((caro.wasted / 30) * 30, 6);
  });

  it("gasto sem posto entra no total mas não some do ranking", () => {
    const r = stationStats(
      [...mesmoConsumo, fill("2026-09-23", 30, null, 5.4, 12900)],
      new Set(lastNDays(TODAY, 30)),
      30,
    );
    expect(r.unlabeledSpent).toBe(30);
    expect(r.stations.map((s) => s.label)).toContain("Sem posto informado");
    expect(r.totalSpent).toBe(35 + 40 + 36 + 42 + 30);
  });

  it("não conta marmita como combustível", () => {
    const r = stationStats([food(TODAY, 25)], new Set(lastNDays(TODAY, 30)), 30);
    expect(r.stations).toHaveLength(0);
    expect(r.totalSpent).toBe(0);
  });

  it("usa o preço do litro quando ainda não há odômetro para medir km/l", () => {
    const semOdo: FuelExpense[] = [
      fill("2026-09-20", 30, "Posto A", 5.5, null),
      fill("2026-09-22", 30, "Posto B", 5.0, null),
    ];
    const r = stationStats(semOdo, new Set(lastNDays(TODAY, 30)), 30);
    expect(r.rankedBy).toBe("price_liter");
    expect(r.measuredStations).toBe(0);
    // A: 30/5,5 = R$ 5,45/L  ·  B: 30/5,0 = R$ 6,00/L → A deixa mais lucro
    expect(r.best?.label).toBe("Posto A");
    expect(r.worst?.label).toBe("Posto B");
    expect(r.best?.costPerKm).toBeNull();
    expect(r.best?.pricePerLiter).toBeCloseTo(30 / 5.5, 6);
    expect(r.worst?.pricePerLiter).toBeCloseTo(6, 6);
    // diferença paga a mais no posto B: (6,00 − 5,45…) × 5 litros comprados lá
    expect(r.worst!.wasted).toBeCloseTo((6 - 30 / 5.5) * 5, 6);
    expect(r.worst!.gapPct).toBeCloseTo((6 - 30 / 5.5) / (30 / 5.5), 6);
    expect(r.best!.wasted).toBe(0);
  });

  it("traz o consumo geral do veículo medido no período", () => {
    const r = stationStats(mesmoConsumo, new Set(lastNDays(TODAY, 30)), 30);
    expect(r.overallKmPerLiter).toBeCloseTo((220 + 230 + 210) / (6.3 + 6.7 + 6.5), 5);
    expect(r.overallCostPerKm).toBeCloseTo(
      ((35 + 40 + 36 + 42) / (6.3 + 6.7 + 6.5 + 7.0)) / r.overallKmPerLiter!,
      5,
    );
  });

  it("respeita a janela: abastecimento antigo fica de fora", () => {
    const antigo = fill("2026-01-05", 50, "Posto Velho", 9, 9000);
    const r = stationStats(
      [...mesmoConsumo, antigo],
      new Set(lastNDays(TODAY, 30)),
      30,
    );
    expect(r.stations.map((s) => s.label)).not.toContain("Posto Velho");
    const tudo = stationStats([...mesmoConsumo, antigo], null, 300);
    expect(tudo.stations.map((s) => s.label)).toContain("Posto Velho");
  });

  it("ignora trecho com odômetro que voltou (troca de painel)", () => {
    const comVolta: FuelExpense[] = [
      fill("2026-09-10", 30, "Posto A", 5.5, 50000),
      fill("2026-09-14", 30, "Posto A", 5.5, 120), // odômetro zerado
    ];
    const r = stationStats(comVolta, new Set(lastNDays(TODAY, 30)), 30);
    expect(r.stations[0]!.measuredSegments).toBe(0);
    expect(r.stations[0]!.kmPerLiter).toBeNull();
  });

  it("stationRanking é o atalho por lista de datas", () => {
    const r = stationRanking(mesmoConsumo, lastNDays(TODAY, 30));
    expect(r.days).toBe(30);
    expect(r.best?.label).toBe("Posto Barato");
  });

  it("ordena por gasto quando nada dá para medir", () => {
    const semNada: FuelExpense[] = [
      fill("2026-09-20", 20, "Posto A", null, null),
      fill("2026-09-22", 45, "Posto B", null, null),
    ];
    const r = stationStats(semNada, new Set(lastNDays(TODAY, 30)), 30);
    expect(r.stations[0]!.label).toBe("Posto B");
    expect(r.best).toBeNull(); // sem base de comparação não declara campeão
  });
});

describe("textos gerados", () => {
  it("descreve o abastecimento na lista", () => {
    // R$ do Intl usa espaço fino (U+00A0) entre símbolo e número
    expect(fuelLine(fill(TODAY, 40, "Posto Shell", 7.2, 12100))).toBe(
      "Posto Shell · 7,2 L · R$\u00a05,56/L",
    );
    expect(fuelLine(fill(TODAY, 40, null, null, 12100))).toBe("");
  });

  it("fuelFillUps devolve só combustível em ordem cronológica", () => {
    const list = fuelFillUps([
      food(TODAY, 10),
      fill("2026-09-20", 30, "A", 5, 100),
      fill("2026-09-10", 30, "B", 5, 50),
    ]);
    expect(list.map((f) => f.date)).toEqual(["2026-09-10", "2026-09-20"]);
  });

  it("insight compara os postos e mostra o dinheiro perdido", () => {
    const despesas: FuelExpense[] = [
      fill("2026-09-10", 35, "Posto Barato", 6.3, 12000),
      fill("2026-09-14", 40, "Posto Caro", 6.7, 12220),
      fill("2026-09-18", 36, "Posto Barato", 6.5, 12450),
    ];
    const out = stationInsights(despesas, lastNDays(TODAY, 30), { kmPerLiter: 35 });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.tone).toBe("good");
    expect(out[0]!.text).toContain("Posto Barato");
    expect(out[0]!.text).toContain("Posto Caro");
  });

  it("sem dois postos comparáveis não gera insight", () => {
    const um: FuelExpense[] = [fill("2026-09-10", 35, "Posto Barato", 6.3, 12000)];
    expect(stationInsights(um, lastNDays(TODAY, 30), { kmPerLiter: 35 })).toEqual([]);
    expect(stationInsights([], lastNDays(TODAY, 30), { kmPerLiter: 35 })).toEqual([]);
  });

  it("avisa quando o consumo medido difere muito do configurado", () => {
    const despesas: FuelExpense[] = [
      fill("2026-09-10", 35, "Posto A", 6.3, 12000),
      fill("2026-09-14", 40, "Posto B", 6.7, 12220),
      fill("2026-09-18", 36, "Posto A", 6.5, 12450),
    ];
    const out = stationInsights(despesas, lastNDays(TODAY, 30), { kmPerLiter: 45 });
    expect(out.some((i) => i.text.includes("km/l"))).toBe(true);
  });
});
