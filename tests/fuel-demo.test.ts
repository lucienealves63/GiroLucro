import { expenses } from "@/db/schema";
import { stationStats } from "@/lib/fuel";
import { createTestDbWithSchema, type TestDb } from "./helpers/pgmem";

/**
 * Mesmos postos/preços usados pelo gerador de dados de exemplo
 * (`/api/seed`): o barato rende menos, o caro rende mais — e no custo por km o
 * mais caro vence. É o caso que mostra por que comparar só o preço do litro
 * engana.
 */
const STATIONS = [
  { name: "Posto Shell Centro", price: 5.89, kml: 37 },
  { name: "Posto do Zé", price: 5.39, kml: 30 },
  { name: "Ipiranga Av. Brasil", price: 5.69, kml: 35 },
];

let db: TestDb;

beforeEach(async () => {
  db = await createTestDbWithSchema();
});

it("ranking dos dados de exemplo: o posto mais caro por litro é o que dá mais lucro", async () => {
  let odo = 12000;
  for (let i = 0; i < 9; i++) {
    const st = STATIONS[i % STATIONS.length]!;
    const km = 200;
    const liters = Math.round((km / st.kml) * 100) / 100;
    const date = `2026-09-${String(10 + i).padStart(2, "0")}`;
    await db.insert(expenses).values({
      userId: 1,
      date,
      type: "combustivel",
      amount: Math.round(liters * st.price * 100) / 100,
      odometer: odo,
      station: st.name,
      liters,
    });
    odo += km;
  }

  const rows = await db.select().from(expenses);
  expect(rows).toHaveLength(9);
  expect(rows.every((r) => r.station && r.liters)).toBe(true);

  const dates = rows.map((r) => r.date);
  const r = stationStats(rows, new Set(dates), dates.length);

  expect(r.rankedBy).toBe("km_liter");
  expect(r.measuredStations).toBe(3);
  // R$/litro: Zé (5,39) < Ipiranga (5,69) < Shell (5,89)
  const byLabel = Object.fromEntries(r.stations.map((s) => [s.label, s]));
  expect(byLabel["Posto do Zé"]!.pricePerLiter!).toBeLessThan(
    byLabel["Ipiranga Av. Brasil"]!.pricePerLiter!,
  );
  // mas no custo por km o Shell ganha: 5,89/37 < 5,69/35 < 5,39/30
  expect(r.stations.map((s) => s.label)).toEqual([
    "Posto Shell Centro",
    "Ipiranga Av. Brasil",
    "Posto do Zé",
  ]);
  // (os litros do seed são arredondados em 2 casas, daí a tolerância)
  expect(r.best?.costPerKm).toBeCloseTo(5.89 / 37, 3);
  expect(r.worst?.costPerKm).toBeCloseTo(5.39 / 30, 3);
  expect(r.best!.costPerKm!).toBeLessThan(r.worst!.costPerKm!);
  expect(r.worst!.wasted).toBeGreaterThan(0);
  expect(r.worst!.monthlyImpact).toBeGreaterThan(0);

  // consumo geral medido fica perto da média dos três postos
  expect(r.overallKmPerLiter!).toBeGreaterThan(33);
  expect(r.overallKmPerLiter!).toBeLessThan(35);
});
