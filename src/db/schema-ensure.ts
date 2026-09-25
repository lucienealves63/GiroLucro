import { pool } from "./index";

/**
 * Fonte única de verdade do schema do GiroLucro.
 *
 * Usado em dois lugares:
 *  1. `ensureSchema()` (chamado automaticamente em `src/instrumentation.ts`
 *     no início de cada instância do servidor) — mantém o banco no mesmo
 *     estado do código a cada deploy, sem nenhum passo manual.
 *  2. `/api/admin/setup?token=...` — diagnóstico/reexecução manual com
 *     tela de resultado.
 *
 * Todas as declarações são idempotentes (IF NOT EXISTS / detecção prévia),
 * então rodar em paralelo ou repetir nunca quebra nada.
 */

export type SetupKind = "table" | "index" | "column";

type SetupStatement = {
  name: string;
  kind: SetupKind;
  /** Para kind=column: tabela alvo. */
  table?: string;
  /** Para kind=column: nome da coluna. */
  column?: string;
  sql: string;
};

export const STATEMENTS: SetupStatement[] = [
  {
    name: "billing_events",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "billing_events" (
      "id" serial PRIMARY KEY NOT NULL,
      "provider" text DEFAULT 'mercado_pago' NOT NULL,
      "event_key" text NOT NULL,
      "event_type" text NOT NULL,
      "resource_id" text NOT NULL,
      "user_id" integer,
      "status" text DEFAULT 'processed' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "contact_messages",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "contact_messages" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "email" text NOT NULL,
      "phone" text,
      "topic" text DEFAULT 'duvida' NOT NULL,
      "body" text NOT NULL,
      "status" text DEFAULT 'novo' NOT NULL,
      "user_id" integer,
      "visitor_id" text,
      "source_path" text,
      "reply_to_email" boolean DEFAULT false NOT NULL,
      "ip_hash" text,
      "user_agent" text,
      "email_sent" boolean DEFAULT false NOT NULL,
      "email_error" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "answered_at" timestamp with time zone
    )`,
  },
  {
    name: "expenses",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "expenses" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer,
      "date" text NOT NULL,
      "type" text NOT NULL,
      "amount" numeric(10, 2) NOT NULL,
      "odometer" numeric(10, 1),
      "station" text,
      "liters" numeric(8, 2),
      "note" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "maintenances",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "maintenances" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer,
      "type" text NOT NULL,
      "date" text NOT NULL,
      "km_done" numeric(10, 1) NOT NULL,
      "cost" numeric(10, 2) DEFAULT 0 NOT NULL,
      "interval_km" numeric(10, 1) DEFAULT 0 NOT NULL,
      "note" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "notification_logs",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "notification_logs" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "type" text NOT NULL,
      "title" text NOT NULL,
      "body" text NOT NULL,
      "sent_at" timestamp with time zone DEFAULT now() NOT NULL,
      "opened" boolean DEFAULT false NOT NULL
    )`,
  },
  {
    name: "page_views",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "page_views" (
      "id" serial PRIMARY KEY NOT NULL,
      "visitor_id" text NOT NULL,
      "session_id" text NOT NULL,
      "path" text NOT NULL,
      "referrer" text,
      "referrer_domain" text,
      "channel" text DEFAULT 'direto' NOT NULL,
      "source" text,
      "medium" text,
      "campaign" text,
      "device_type" text DEFAULT 'desktop' NOT NULL,
      "browser" text,
      "os" text,
      "country" text,
      "language" text,
      "user_id" integer,
      "dwell_ms" integer DEFAULT 0 NOT NULL,
      "is_bot" boolean DEFAULT false NOT NULL,
      "day" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "push_subscriptions",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "push_subscriptions" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "endpoint" text NOT NULL,
      "auth" text NOT NULL,
      "p256dh" text NOT NULL,
      "user_agent" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "last_sent_at" timestamp with time zone
    )`,
  },
  {
    name: "sessions",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "sessions" (
      "token" text PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "password_reset_tokens",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "token_hash" text NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "used_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "settings",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer,
      "vehicle_type" text DEFAULT 'moto' NOT NULL,
      "vehicle_name" text DEFAULT '' NOT NULL,
      "km_per_liter" numeric(8, 2) DEFAULT 35 NOT NULL,
      "fuel_price" numeric(8, 2) DEFAULT 5.79 NOT NULL,
      "maintenance_per_km" numeric(8, 3) DEFAULT 0.15 NOT NULL,
      "fuel_mode" text DEFAULT 'estimate' NOT NULL,
      "monthly_rent" numeric(10, 2) DEFAULT 0 NOT NULL,
      "monthly_phone" numeric(10, 2) DEFAULT 59.9 NOT NULL,
      "monthly_insurance" numeric(10, 2) DEFAULT 0 NOT NULL,
      "monthly_goal" numeric(10, 2) DEFAULT 3500 NOT NULL,
      "work_days_per_week" integer DEFAULT 6 NOT NULL,
      "reserve_percent" numeric(5, 2) DEFAULT 10 NOT NULL,
      "initial_odometer" numeric(10, 1) DEFAULT 0 NOT NULL,
      "platforms_json" text,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "users",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "users" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "email" text NOT NULL,
      "password_hash" text NOT NULL,
      "plan_status" text DEFAULT 'trialing' NOT NULL,
      "plan_cycle" text,
      "trial_ends_at" timestamp with time zone,
      "current_period_end" timestamp with time zone,
      "billing_customer_id" text,
      "terms_accepted_at" timestamp with time zone,
      "terms_version" text,
      "privacy_accepted_at" timestamp with time zone,
      "privacy_version" text,
      "payment_id" text,
      "payment_provider" text,
      "paid_at" timestamp with time zone,
      "payment_amount" numeric(10, 2),
      "payment_status" text,
      "refund_requested_at" timestamp with time zone,
      "refunded_at" timestamp with time zone,
      "refund_status" text DEFAULT 'none',
      "deleted_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "work_entries",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "work_entries" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer,
      "date" text NOT NULL,
      "platform" text NOT NULL,
      "gross" numeric(10, 2) NOT NULL,
      "hours" numeric(6, 2) DEFAULT 0 NOT NULL,
      "km" numeric(8, 1) DEFAULT 0 NOT NULL,
      "quantity" integer DEFAULT 1 NOT NULL,
      "wait_minutes" numeric(6, 1) DEFAULT 0 NOT NULL,
      "settled" boolean DEFAULT false NOT NULL,
      "period" text DEFAULT 'tarde' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "legal_acceptances",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "legal_acceptances" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "document_type" text NOT NULL,
      "document_version" text NOT NULL,
      "accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
      "source" text DEFAULT 'signup' NOT NULL
    )`,
  },
  {
    name: "data_subject_requests",
    kind: "table",
    sql: `CREATE TABLE IF NOT EXISTS "data_subject_requests" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer,
      "request_type" text NOT NULL,
      "status" text DEFAULT 'received' NOT NULL,
      "channel" text DEFAULT 'app' NOT NULL,
      "note" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "completed_at" timestamp with time zone
    )`,
  },
  {
    name: "users_email_idx",
    kind: "index",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email")`,
  },
  {
    name: "password_reset_token_hash_idx",
    kind: "index",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_token_hash_idx" ON "password_reset_tokens" USING btree ("token_hash")`,
  },
  {
    name: "settings_user_idx",
    kind: "index",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "settings_user_idx" ON "settings" USING btree ("user_id")`,
  },
  {
    name: "billing_events_provider_key_idx",
    kind: "index",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "billing_events_provider_key_idx" ON "billing_events" USING btree ("provider", "event_key")`,
  },
  // Índices do painel de acessos / contato (mesma ordem das tabelas acima)
  {
    name: "page_views_day_idx",
    kind: "index",
    sql: `CREATE INDEX IF NOT EXISTS "page_views_day_idx" ON "page_views" USING btree ("day")`,
  },
  {
    name: "page_views_created_idx",
    kind: "index",
    sql: `CREATE INDEX IF NOT EXISTS "page_views_created_idx" ON "page_views" USING btree ("created_at")`,
  },
  {
    name: "page_views_visitor_day_idx",
    kind: "index",
    sql: `CREATE INDEX IF NOT EXISTS "page_views_visitor_day_idx" ON "page_views" USING btree ("visitor_id", "day")`,
  },
  {
    name: "page_views_user_idx",
    kind: "index",
    sql: `CREATE INDEX IF NOT EXISTS "page_views_user_idx" ON "page_views" USING btree ("user_id")`,
  },
  {
    name: "contact_messages_created_idx",
    kind: "index",
    sql: `CREATE INDEX IF NOT EXISTS "contact_messages_created_idx" ON "contact_messages" USING btree ("created_at")`,
  },
  {
    name: "contact_messages_status_idx",
    kind: "index",
    sql: `CREATE INDEX IF NOT EXISTS "contact_messages_status_idx" ON "contact_messages" USING btree ("status")`,
  },
  {
    name: "contact_messages_ip_idx",
    kind: "index",
    sql: `CREATE INDEX IF NOT EXISTS "contact_messages_ip_idx" ON "contact_messages" USING btree ("ip_hash", "created_at")`,
  },
  {
    name: "legal_acceptances_user_idx",
    kind: "index",
    sql: `CREATE INDEX IF NOT EXISTS "legal_acceptances_user_idx" ON "legal_acceptances" USING btree ("user_id")`,
  },
  {
    name: "legal_acceptances_doc_idx",
    kind: "index",
    sql: `CREATE INDEX IF NOT EXISTS "legal_acceptances_doc_idx" ON "legal_acceptances" USING btree ("document_type", "document_version")`,
  },
  {
    name: "data_subject_requests_user_idx",
    kind: "index",
    sql: `CREATE INDEX IF NOT EXISTS "data_subject_requests_user_idx" ON "data_subject_requests" USING btree ("user_id")`,
  },
  {
    name: "data_subject_requests_type_idx",
    kind: "index",
    sql: `CREATE INDEX IF NOT EXISTS "data_subject_requests_type_idx" ON "data_subject_requests" USING btree ("request_type", "created_at")`,
  },
  {
    name: "expenses_user_station_idx",
    kind: "index",
    sql: `CREATE INDEX IF NOT EXISTS "expenses_user_station_idx" ON "expenses" USING btree ("user_id", "station")`,
  },
  // Migration: bancos antigos (tabela settings já existia sem a coluna)
  {
    name: "settings.platforms_json",
    kind: "column",
    table: "settings",
    column: "platforms_json",
    sql: `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "platforms_json" text`,
  },
  // Migration: combustível por posto (colunas novas em `expenses`)
  ...(
    [
      ["station", `text`],
      ["liters", `numeric(8, 2)`],
    ] as const
  ).map(([column, type]) => ({
    name: `expenses.${column}`,
    kind: "column" as const,
    table: "expenses",
    column,
    sql: `ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
  })),
  // Migration LGPD/aceite/compras: colunas novas em `users`
  ...(
    [
      ["terms_accepted_at", `timestamp with time zone`],
      ["terms_version", `text`],
      ["privacy_accepted_at", `timestamp with time zone`],
      ["privacy_version", `text`],
      ["payment_id", `text`],
      ["payment_provider", `text`],
      ["paid_at", `timestamp with time zone`],
      ["payment_amount", `numeric(10, 2)`],
      ["payment_status", `text`],
      ["refund_requested_at", `timestamp with time zone`],
      ["refunded_at", `timestamp with time zone`],
      ["refund_status", `text DEFAULT 'none'`],
      ["deleted_at", `timestamp with time zone`],
    ] as const
  ).map(([column, type]) => ({
    name: `users.${column}`,
    kind: "column" as const,
    table: "users",
    column,
    sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
  })),
];


export async function alreadyExists(st: SetupStatement): Promise<boolean> {
  if (st.kind === "table") {
    const r = await pool.query("SELECT to_regclass($1) AS reg", [`public.${st.name}`]);
    return !!r.rows[0]?.reg;
  }
  if (st.kind === "index") {
    const r = await pool.query("SELECT 1 FROM pg_indexes WHERE indexname = $1 LIMIT 1", [
      st.name,
    ]);
    return (r.rowCount ?? 0) > 0;
  }
  // column
  const r = await pool.query(
    `SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1`,
    [st.table, st.column],
  );
  return (r.rowCount ?? 0) > 0;
}


export type SchemaEnsureResult = {
  /** 1 se uma verificação de schema foi efetuada, 0 se pulou (já ok/cool down). */
  checked: 0 | 1;
  /** Quantas declarações foram criadas agora. */
  applied: number;
  /** Quantas já existiam. */
  skipped: number;
  /** Quantas falharam. */
  failed: number;
  /** Mensagens de erro (uma por declaração falhada). */
  errors: string[];
};

/** Chave do advisory lock — qualquer número estável serve. */
const SCHEMA_LOCK_KEY = 761204;

/** Espera entre tentativas de pegar o lock. */
const LOCK_RETRY_MS = 250;

/** Tempo máximo tentando pegar o lock. */
const LOCK_WAIT_MAX_MS = 5000;

/** Não martelar o banco: após falha, tenta de novo só depois disso. */
const FAIL_COOLDOWN_MS = 30_000;

const globalForEnsure = globalThis as typeof globalThis & {
  __girolucroSchemaEnsure?: {
    done: boolean;
    lastFailAt: number;
    running: Promise<SchemaEnsureResult> | null;
  };
};

function ensureState() {
  if (!globalForEnsure.__girolucroSchemaEnsure) {
    globalForEnsure.__girolucroSchemaEnsure = {
      done: false,
      lastFailAt: 0,
      running: null,
    };
  }
  return globalForEnsure.__girolucroSchemaEnsure;
}

/**
 * Verificação barata (3 consultas) de que TODAS as declarações do schema
 * já existem. Sem marcador de versão: nada fica "desincronizado" se alguém
 * aplicar um passo manualmente.
 */
async function allStatementsSatisfied(): Promise<boolean> {
  const tables = STATEMENTS.filter((s) => s.kind === "table").map((s) => s.name);
  const indexes = STATEMENTS.filter((s) => s.kind === "index").map((s) => s.name);
  const columns = STATEMENTS.filter((s) => s.kind === "column").map(
    (s) => [s.table as string, s.column as string],
  );

  const [tablesRes, indexesRes, columnsRes] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS n
         FROM (SELECT unnest($1::text[]) AS name) x
        WHERE to_regclass('public.' || x.name) IS NOT NULL`,
      [tables],
    ),
    pool.query(
      `SELECT count(*)::int AS n FROM pg_indexes WHERE indexname = ANY($1::text[])`,
      [indexes],
    ),
    pool.query(
      `SELECT count(*)::int AS n
         FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND EXISTS (
            SELECT 1
              FROM unnest($1::text[], $2::text[]) AS u(tbl, col)
             WHERE u.tbl = c.table_name
               AND u.col = c.column_name
          )`,
      [columns.map((x) => x[0]), columns.map((x) => x[1])],
    ),
  ]);

  return (
    (tablesRes.rows[0]?.n ?? 0) === tables.length &&
    (indexesRes.rows[0]?.n ?? 0) === indexes.length &&
    (columnsRes.rows[0]?.n ?? 0) === columns.length
  );
}

async function acquireLock(): Promise<boolean> {
  const deadline = Date.now() + LOCK_WAIT_MAX_MS;
  for (;;) {
    try {
      const r = await pool.query("SELECT pg_try_advisory_lock($1::bigint) AS got", [
        SCHEMA_LOCK_KEY,
      ]);
      if (r.rows[0]?.got) return true;
    } catch {
      return false; // sem lock não é fim do mundo: o SQL é idempotente
    }
    if (Date.now() + LOCK_RETRY_MS > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }
}

function releaseLock(): void {
  pool
    .query("SELECT pg_advisory_unlock($1::bigint)", [SCHEMA_LOCK_KEY])
    .catch(() => {});
}

/**
 * Garante que o schema do banco está no mesmo estado do código.
 *
 * - Em estado normal (schema em dia): 3 consultas e pronto.
 * - Após um deploy com schema novo: aplica as declarações em falta
 *   (todas idempotentes) e loga o que foi criado.
 * - Falhas não propagam: registra erro e tenta de novo no próximo
 *   cold start (com cooldown para não martelar o banco).
 *
 * Projetado para ser chamado de `src/instrumentation.ts` no boot.
 */
export async function ensureSchema(): Promise<SchemaEnsureResult> {
  const s = ensureState();
  if (s.done) return { checked: 0, applied: 0, skipped: 0, failed: 0, errors: [] };
  if (s.running) return s.running;

  const run = (async (): Promise<SchemaEnsureResult> => {
    const now = Date.now();
    if (now - s.lastFailAt < FAIL_COOLDOWN_MS) {
      return { checked: 0, applied: 0, skipped: 0, failed: 0, errors: [] };
    }

    const holdLock = await acquireLock();
    try {
      const satisfied = await allStatementsSatisfied();
      if (satisfied) {
        s.done = true;
        return { checked: 1, applied: 0, skipped: STATEMENTS.length, failed: 0, errors: [] };
      }

      // Mesmo esquema do setup manual: declaração por declaração, idempotente,
      // continua em frente se algo falhar (progresso parcial > bloqueio total).
      const result: SchemaEnsureResult = {
        checked: 1,
        applied: 0,
        skipped: 0,
        failed: 0,
        errors: [],
      };
      for (const st of STATEMENTS) {
        try {
          const existed = await alreadyExists(st);
          await pool.query(st.sql);
          if (existed) result.skipped++;
          else result.applied++;
        } catch (e: unknown) {
          result.failed++;
          result.errors.push(
            `${st.name}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }

      if (result.failed === 0) {
        s.done = true;
      } else {
        s.lastFailAt = Date.now();
      }
      return result;
    } catch (e: unknown) {
      // Erro inesperado (ex.: banco fora do ar) — nunca propaga: marca
      // cooldown para o próximo cold start tentar de novo.
      s.lastFailAt = Date.now();
      return {
        checked: 1,
        applied: 0,
        skipped: 0,
        failed: 1,
        errors: [`verificação do schema: ${e instanceof Error ? e.message : String(e)}`],
      };
    } finally {
      if (holdLock) releaseLock();
    }
  })();

  s.running = run;
  try {
    return await run;
  } finally {
    if (s.running === run) s.running = null;
  }
}
