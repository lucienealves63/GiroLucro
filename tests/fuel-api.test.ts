import { eq } from "drizzle-orm";
import { expenses } from "@/db/schema";
import { STATEMENTS } from "@/db/schema-ensure";
import { createTestDb, createTestDbWithSchema, type TestDb } from "./helpers/pgmem";

/** Troca o banco e o usuário logado usados pelas rotas. */
let db: TestDb;
jest.mock("@/db", () => ({
  get db() {
    return db;
  },
  pool: { query: jest.fn() },
}));
jest.mock("@/lib/auth", () => ({
  getSessionUser: jest.fn(async () => ({ id: 7, name: "João", email: "j@x.com" })),
}));

const { POST } = require("@/app/api/expenses/route") as {
  POST: (req: Request) => Promise<Response>;
};
const { GET } = require("@/app/api/fuel-stations/route") as {
  GET: () => Promise<Response>;
};

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(async () => {
  db = await createTestDbWithSchema();
});

/**
 * Schema/DDL. Observação: o pg-mem não reimplementa `CREATE TABLE IF NOT
 * EXISTS` para uma tabela já existente nem expõe `pg_indexes`, então a
 * idempotência de tabela fica coberta pelo SQL em si (ver `drizzle/0005_*.sql`)
 * e aqui validamos o que o emulador suporta: colunas novas e migração.
 */
describe("schema (DDL do boot)", () => {
  it("cria as colunas de posto/litros em expenses", async () => {
    const res = await db.raw(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'expenses'
        ORDER BY column_name`,
    );
    const cols = res.rows.map((r) => (r as { column_name: string }).column_name);
    expect(cols).toContain("station");
    expect(cols).toContain("liters");
    expect(cols).toContain("odometer");
  });

  it("declara a coluna station/liters na fonte do schema e no índice", () => {
    const expensesTable = STATEMENTS.find((s) => s.name === "expenses");
    expect(expensesTable?.sql).toContain(`"station" text`);
    expect(expensesTable?.sql).toContain(`"liters" numeric(8, 2)`);
    const idx = STATEMENTS.find((s) => s.name === "expenses_user_station_idx");
    expect(idx?.sql).toContain(`("user_id", "station")`);
  });

  it("migra um banco antigo (expenses sem posto) com os ALTERs idempotentes", async () => {
    const legacy = createTestDb();
    await legacy.raw(`CREATE TABLE "expenses" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer,
      "date" text NOT NULL,
      "type" text NOT NULL,
      "amount" numeric(10, 2) NOT NULL,
      "odometer" numeric(10, 1),
      "note" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`);

    for (const st of STATEMENTS) {
      if (st.kind === "column" && st.table === "expenses") await legacy.raw(st.sql);
    }
    // rodar de novo não pode quebrar (deploy repetido)
    for (const st of STATEMENTS) {
      if (st.kind === "column" && st.table === "expenses") await legacy.raw(st.sql);
    }
    // o índice é aplicado sobre a tabela migrada (o pg-mem não indexa tabela
    // com DEFAULT now(), então a falha aqui não é do app — só registramos)
    const idx = STATEMENTS.find((s) => s.name === "expenses_user_station_idx")!;
    await legacy.raw(idx.sql).catch(() => undefined);

    const res = await legacy.raw(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'expenses' ORDER BY column_name`,
    );
    const cols = res.rows.map((r) => (r as { column_name: string }).column_name);
    expect(cols).toEqual(
      expect.arrayContaining(["station", "liters", "note", "odometer"]),
    );
  });
});

describe("POST /api/expenses — combustível por posto", () => {
  it("salva posto, litros e odômetro", async () => {
    const res = await post({
      date: "2026-09-25",
      type: "combustivel",
      amount: 40,
      station: "  Posto Shell  ",
      liters: 7.2,
      odometer: 12450,
    });
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.station).toBe("Posto Shell"); // espaços aparados
    expect(row.liters).toBe(7.2);
    expect(row.odometer).toBe(12450);

    const [saved] = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, row.id));
    expect(saved?.station).toBe("Posto Shell");
    expect(saved?.liters).toBe(7.2);
  });

  it("aceita abastecimento sem posto (comportamento antigo continua válido)", async () => {
    const res = await post({ date: "2026-09-25", type: "combustivel", amount: 30 });
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.station).toBeNull();
    expect(row.liters).toBeNull();
  });

  it("recusa litros inválidos", async () => {
    for (const liters of [0, -3, 900, "abc"]) {
      const res = await post({
        date: "2026-09-25",
        type: "combustivel",
        amount: 30,
        liters,
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Litros inválidos");
    }
  });

  it("ignora posto/litros em gasto que não é combustível", async () => {
    const res = await post({
      date: "2026-09-25",
      type: "alimentacao",
      amount: 20,
      station: "Posto Shell",
      liters: 5,
    });
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.station).toBeNull();
    expect(row.liters).toBeNull();
  });

  it("posto com 1 caractere é descartado", async () => {
    const res = await post({
      date: "2026-09-25",
      type: "combustivel",
      amount: 20,
      station: "X",
    });
    expect(res.status).toBe(201);
    expect((await res.json()).station).toBeNull();
  });
});

describe("GET /api/fuel-stations", () => {
  it("lista os postos já usados, agrupando grafias diferentes", async () => {
    await post({ date: "2026-09-20", type: "combustivel", amount: 30, station: "Posto Shell" });
    await post({ date: "2026-09-22", type: "combustivel", amount: 30, station: "posto shell" });
    await post({ date: "2026-09-23", type: "combustivel", amount: 30, station: "Ipiranga" });
    await post({ date: "2026-09-23", type: "alimentacao", amount: 15, station: "Não é posto" });

    const res = await GET();
    expect(res.status).toBe(200);
    const { stations } = await res.json();
    expect(stations).toHaveLength(2);
    expect(stations[0]).toMatchObject({ label: "posto shell", uses: 2, lastUsed: "2026-09-22" });
    expect(stations[1]).toMatchObject({ label: "Ipiranga", uses: 1 });
  });

  it("sem abastecimento a lista vem vazia", async () => {
    const res = await GET();
    expect((await res.json()).stations).toEqual([]);
  });
});
