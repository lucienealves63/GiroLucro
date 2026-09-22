import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

/**
 * `DATABASE_POOL_MAX` permite limitar conexões por instância — útil em
 * ambientes serverless (ex.: Vercel + Neon) e em bancos com limite baixo.
 * Padrão do driver: 10.
 */
const poolMax = Number.parseInt(process.env.DATABASE_POOL_MAX ?? "", 10);

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
    ...(Number.isFinite(poolMax) && poolMax > 0 ? { max: poolMax } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
