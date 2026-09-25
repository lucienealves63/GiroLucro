/**
 * @jest-environment jsdom
 */
import TestRenderer from "react-test-renderer";
import { expenses, settings, users } from "@/db/schema";
import { createTestDbWithSchema, type TestDb } from "./helpers/pgmem";

let db: TestDb;
jest.mock("@/db", () => ({
  get db() {
    return db;
  },
  pool: { query: jest.fn() },
}));
// o client usa useRouter (só existe dentro do App Router montado)
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
  usePathname: () => "/postos",
}));
jest.mock("@/lib/auth", () => ({
  requireUser: jest.fn(async () => ({
    id: 1,
    name: "João Teste",
    email: "joao@teste.com",
    planStatus: "active",
  })),
  getSessionUser: jest.fn(async () => ({ id: 1, name: "João Teste" })),
}));

/** 3 postos com preços e rendimentos diferentes (o caro rende mais). */
const FILLUPS = [
  { date: "2026-09-10", station: "Posto Shell Centro", liters: 5.41, km: 200, price: 5.89 },
  { date: "2026-09-11", station: "Posto do Zé", liters: 6.67, km: 200, price: 5.39 },
  { date: "2026-09-12", station: "Ipiranga Av. Brasil", liters: 5.71, km: 200, price: 5.69 },
  { date: "2026-09-13", station: "Posto Shell Centro", liters: 5.41, km: 200, price: 5.89 },
  { date: "2026-09-14", station: "Posto do Zé", liters: 6.67, km: 200, price: 5.39 },
  { date: "2026-09-15", station: "Ipiranga Av. Brasil", liters: 5.71, km: 200, price: 5.69 },
];

async function seed() {
  await db.insert(users).values({
    id: 1,
    name: "João Teste",
    email: "joao@teste.com",
    passwordHash: "x",
  });
  await db.insert(settings).values({ userId: 1, kmPerLiter: 35, fuelPrice: 5.79 });
  let odo = 12000;
  for (const f of FILLUPS) {
    await db.insert(expenses).values({
      userId: 1,
      date: f.date,
      type: "combustivel",
      amount: Math.round(f.liters * f.price * 100) / 100,
      odometer: odo,
      station: f.station,
      liters: f.liters,
    });
    odo += f.km;
  }
}

beforeEach(async () => {
  db = await createTestDbWithSchema();
  await seed();
});

describe("/postos (página)", () => {
  it("monta o view-model com o ranking por lucro líquido", async () => {
    const { default: PostosPage } = await import("@/app/postos/page");
    const vm = (await PostosPage()) as unknown as {
      props: {
        month: {
          rankedBy: string;
          best: { label: string; costPerKm: number | null } | null;
          worst: { label: string; wasted: number } | null;
          stations: { label: string; rank: number; wasted: number }[];
          totalSpent: number;
          overallKmPerLiter: number | null;
          measuredStations: number;
        };
        fillUps: { station: string | null; litersLine: string }[];
        hasFuel: boolean;
      };
    };
    const { month, fillUps, hasFuel } = vm.props;

    expect(hasFuel).toBe(true);
    expect(month.rankedBy).toBe("km_liter");
    expect(month.measuredStations).toBe(3);
    expect(month.best?.label).toBe("Posto Shell Centro");
    expect(month.worst?.label).toBe("Posto do Zé");
    expect(month.stations.map((s) => s.label)).toEqual([
      "Posto Shell Centro",
      "Ipiranga Av. Brasil",
      "Posto do Zé",
    ]);
    expect(month.worst!.wasted).toBeGreaterThan(0);
    expect(month.totalSpent).toBeGreaterThan(0);
    // 5 trechos medidos de 200 km (o último abastecimento ainda não fechou trecho)
    const measuredLiters = FILLUPS.slice(0, 5).reduce((a, f) => a + f.liters, 0);
    expect(month.overallKmPerLiter!).toBeCloseTo(1000 / measuredLiters, 4);

    // lista de abastecimentos vem do mais recente para o mais antigo
    expect(fillUps[0]!.station).toBe("Ipiranga Av. Brasil");
    expect(fillUps[0]!.litersLine).toMatch(/^5,7 L · R\$/);
    expect(fillUps).toHaveLength(FILLUPS.length);
  });

  it("renderiza a tela com o campeão e o ranking", async () => {
    const { default: PostosPage } = await import("@/app/postos/page");
    const element = await PostosPage();
    let tree: TestRenderer.ReactTestRenderer | undefined;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(element);
    });
    const text = JSON.stringify(tree!.toJSON());
    expect(text).toContain("Mais lucro líquido");
    expect(text).toContain("Posto Shell Centro");
    expect(text).toContain("Posto do Zé");
    expect(text).toContain("Ranking dos postos");
    expect(text).toContain("Como o lucro por posto é calculado");
    await TestRenderer.act(async () => tree!.unmount());
  });

  it("tela vazia quando não há abastecimento", async () => {
    const { and, eq, sql } = await import("drizzle-orm");
    await db.delete(expenses).where(and(eq(expenses.userId, 1), sql`type = 'combustivel'`));
    const { default: PostosPage } = await import("@/app/postos/page");
    const element = await PostosPage();
    let tree: TestRenderer.ReactTestRenderer | undefined;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(element);
    });
    expect(JSON.stringify(tree!.toJSON())).toContain("Nenhum abastecimento registrado");
    await TestRenderer.act(async () => tree!.unmount());
  });
});
