import { NextResponse } from "next/server";
import { pool } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Setup do banco de dados via navegador — sem terminal, sem CLI.
 *
 * Após o deploy na Vercel, acesse UMA VEZ:
 *   https://SEU-DOMINIO/api/admin/setup?token=SEU_TOKEN
 *
 * O token é a variável de ambiente ADMIN_SETUP_TOKEN
 * (padrão: "girolucro-setup" — troque em produção!).
 *
 * É idempotente: rodar duas vezes não quebra nada
 * (tabelas existentes são detectadas e puladas).
 */

const STATEMENTS: { name: string; sql: string }[] = [
  {
    name: "billing_events",
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
    name: "expenses",
    sql: `CREATE TABLE IF NOT EXISTS "expenses" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer,
      "date" text NOT NULL,
      "type" text NOT NULL,
      "amount" numeric(10, 2) NOT NULL,
      "odometer" numeric(10, 1),
      "note" text,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "maintenances",
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
    name: "push_subscriptions",
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
    sql: `CREATE TABLE IF NOT EXISTS "sessions" (
      "token" text PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "password_reset_tokens",
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
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "users",
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
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  },
  {
    name: "work_entries",
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
    name: "users_email_idx",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email")`,
  },
  {
    name: "password_reset_token_hash_idx",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_token_hash_idx" ON "password_reset_tokens" USING btree ("token_hash")`,
  },
  {
    name: "settings_user_idx",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "settings_user_idx" ON "settings" USING btree ("user_id")`,
  },
  {
    name: "settings_platforms_json",
    sql: `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "platforms_json" text`,
  },
];

function page(title: string, rows: string, ok: boolean): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GiroLucro — Setup</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #08090c; color: #e4e4e7; font-family: -apple-system, system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 520px; width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 20px; padding: 28px; }
    .logo { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .mark { width: 40px; height: 40px; border-radius: 12px; background: #b8f53c; display: flex; align-items: center; justify-content: center; }
    .mark svg { width: 24px; height: 24px; }
    h1 { font-size: 20px; font-weight: 800; }
    h1 span { color: #b8f53c; }
    .title { font-size: 24px; font-weight: 800; margin: 6px 0 14px; }
    .title.ok { color: #b8f53c; }
    .title.erro { color: #fb7185; }
    ul { list-style: none; margin: 14px 0; }
    li { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13.5px; }
    li b { font-weight: 600; }
    .ok-tag { color: #b8f53c; font-weight: 700; font-size: 12px; }
    .skip-tag { color: #fbbf24; font-weight: 700; font-size: 12px; }
    .err-tag { color: #fb7185; font-weight: 700; font-size: 12px; }
    .next { display: block; text-align: center; margin-top: 20px; background: #b8f53c; color: #08090c; font-weight: 800; padding: 14px; border-radius: 14px; text-decoration: none; font-size: 15px; }
    .hint { margin-top: 16px; font-size: 11.5px; color: #71717a; line-height: 1.6; }
    code { background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 6px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="#08090c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-4.5 6-6"/><path d="M17 7h3v3"/></svg>
      </div>
      <h1>Giro<span>Lucro</span></h1>
    </div>
    <p class="title ${ok ? "ok" : "erro"}">${title}</p>
    <ul>${rows}</ul>
    ${ok ? '<a class="next" href="/criar-conta">Criar minha conta de administrador →</a>' : ""}
    <p class="hint">
      Por segurança, defina <code>ADMIN_SETUP_TOKEN</code> com um valor só seu nas
      variáveis de ambiente — assim ninguém mais roda este setup.
      Cada tabela já é criada com segurança: rodar duas vezes não tem problema.
    </p>
  </div>
</body>
</html>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const expected = process.env.ADMIN_SETUP_TOKEN || "girolucro-setup";

  if (token !== expected) {
    const rows = `<li><b>Token inválido ou ausente.</b><span class="err-tag">ACESSO NEGADO</span></li>`;
    return new NextResponse(page("Não autorizado", rows, false), {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const results: string[] = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const st of STATEMENTS) {
    try {
      // checa existência antes para informar corretamente
      const key = st.name.includes("idx") ? "index" : "table";
      let exists = false;
      if (key === "table") {
        const r = await pool.query("SELECT to_regclass($1) AS reg", [`public.${st.name}`]);
        exists = !!r.rows[0].reg;
      } else {
        const r = await pool.query(
          "SELECT 1 FROM pg_indexes WHERE indexname = $1",
          [st.name],
        );
        exists = r.rowCount! > 0;
      }

      await pool.query(st.sql);
      if (exists) {
        skipped++;
        results.push(
          `<li><b>${st.name}</b><span class="skip-tag">JÁ EXISTIA</span></li>`,
        );
      } else {
        created++;
        results.push(
          `<li><b>${st.name}</b><span class="ok-tag">CRIADA ✓</span></li>`,
        );
      }
    } catch (e: any) {
      failed++;
      results.push(
        `<li><b>${st.name}</b><span class="err-tag">ERRO</span></li>`,
      );
      console.error(`Setup [${st.name}]:`, e.message);
    }
  }

  const ok = failed === 0;
  const title = ok
    ? `Setup concluído! ${created} criada(s), ${skipped} já existiam.`
    : `${failed} erro(s) no setup — confira a DATABASE_URL`;

  return new NextResponse(page(title, results.join(""), ok), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
