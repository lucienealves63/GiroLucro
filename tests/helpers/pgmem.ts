import { newDb, type IMemoryDb } from "pg-mem";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { STATEMENTS } from "@/db/schema-ensure";

type PgRows = Record<string, unknown>[];
type PgResult = { rows: PgRows };
type PgQueryArg =
  | string
  | { text?: string; rowMode?: unknown; types?: unknown; values?: unknown[] };
type PgPool = {
  query: (q: PgQueryArg, params?: unknown[]) => Promise<PgResult>;
};

/**
 * Banco Postgres em memória (pg-mem) com o schema REAL do app.
 *
 * O Drizzle roda em cima do adaptador `pg` do pg-mem, então o SQL que chega ao
 * banco é exatamente o SQL que o app gera (insert/select/group by do Drizzle).
 * Dois detalhes do adaptador são contornados no wrapper:
 *  - ele não implementa `types.getTypeParser` nem `rowMode: "array"`
 *    (opções do driver node-postgres, que não alteram o SQL);
 *  - por isso as linhas voltam como objeto e são devolvidas como array, na
 *    ordem das colunas, que é o formato que o Drizzle mapeia.
 */
export type TestDb = NodePgDatabase<typeof schema> & {
  /** Query SQL crua (usada nos asserts de schema/DDL). */
  raw: (sql: string, params?: unknown[]) => Promise<PgResult>;
};

export function createTestDb(): TestDb {
  const mem: IMemoryDb = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool() as PgPool;
  const originalQuery = pool.query.bind(pool);

  pool.query = (async (q: PgQueryArg, params?: unknown[]) => {
    if (typeof q === "string") return originalQuery(q, params);
    const { rowMode, types: _types, ...rest } = q;
    const res = await originalQuery(rest as PgQueryArg, params);
    if (rowMode === "array") {
      const keys = res.rows[0] ? Object.keys(res.rows[0]) : [];
      return { ...res, rows: res.rows.map((r) => keys.map((k) => r[k])) } as unknown as PgResult;
    }
    return res;
  }) as PgPool["query"];

  const db = drizzle(pool as never, { schema, logger: false }) as unknown as TestDb;
  db.raw = (sql, params = []) => originalQuery(sql, params);
  return db;
}

/** Cria o banco e aplica todas as declarações idempotentes do boot do app. */
export async function createTestDbWithSchema(): Promise<TestDb> {
  const db = createTestDb();
  for (const st of STATEMENTS) await db.raw(st.sql);
  return db;
}
