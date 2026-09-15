import { NextResponse } from "next/server";
import { pool } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Exportação CSV do que o painel mostra — para planilha, Google Sheets ou
 * para você conferir os números por conta própria.
 *
 *   /api/admin/export?token=SEU_TOKEN&table=visits&dias=30
 *
 *   table=visits   → uma linha por visita (path, canal, origem, aparelho, dia)
 *   table=pages    → agregado por página
 *   table=users    → contas e situação de assinatura
 *   table=messages → caixa de entrada do /contato
 */

const TABLES: Record<string, { sql: string; file: string }> = {
  visits: {
    file: "girolucro-acessos",
    sql: `SELECT to_char(created_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') AS "quando",
                 day AS "dia", path AS "pagina", channel AS "canal",
                 coalesce(referrer_domain,'') AS "origem", coalesce(campaign,'') AS "campanha",
                 device_type AS "aparelho", coalesce(browser,'') AS "navegador",
                 coalesce(country,'') AS "pais", coalesce(user_id::text,'') AS "usuario_id",
                 dwell_ms AS "ms_na_pagina", is_bot::int AS "robô"
            FROM page_views
           WHERE day >= to_char(now() - ($1::int * interval '1 day'), 'YYYY-MM-DD')
           ORDER BY created_at DESC
           LIMIT 20000`,
  },
  pages: {
    file: "girolucro-paginas",
    sql: `SELECT path AS "pagina", count(*)::int AS "visualizacoes",
                 count(DISTINCT visitor_id)::int AS "pessoas_unicas",
                 count(DISTINCT session_id)::int AS "visitas",
                 round(coalesce(avg(dwell_ms),0))::int AS "tempo_medio_ms"
            FROM page_views
           WHERE day >= to_char(now() - ($1::int * interval '1 day'), 'YYYY-MM-DD') AND is_bot = false
           GROUP BY path ORDER BY 2 DESC`,
  },
  users: {
    file: "girolucro-assinantes",
    sql: `SELECT u.id, u.name AS "nome", u.email, u.plan_status AS "situacao",
                 coalesce(u.plan_cycle,'') AS "plano",
                 to_char(u.created_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') AS "criada_em",
                 coalesce(to_char(u.trial_ends_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD'),'') AS "trial_ate",
                 coalesce(to_char(u.current_period_end AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD'),'') AS "pago_ate",
                 CASE WHEN u.plan_status IN ('active','canceled') AND u.current_period_end > now() THEN 1 ELSE 0 END AS "pagante"
            FROM users u ORDER BY u.created_at DESC LIMIT 10000`,
  },
  messages: {
    file: "girolucro-contato",
    sql: `SELECT id, to_char(created_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') AS "recebida",
                 name AS "nome", email, coalesce(phone,'') AS "celular", topic AS "assunto",
                 status, replace(replace(body, E'\\n', ' '), E'\\r', '') AS "mensagem",
                 email_sent::int AS "email_enviado", coalesce(source_path,'') AS "pagina"
            FROM contact_messages ORDER BY created_at DESC LIMIT 5000`,
  },
};

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "sem dados no periodo\n";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(";")];
  for (const row of rows) lines.push(headers.map((h) => csvCell(row[h])).join(";"));
  // BOM + ";" = padrão que o Excel em português abre direto
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const expected = process.env.ADMIN_SETUP_TOKEN || "girolucro-setup";
  if (token !== expected) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const key = url.searchParams.get("table") ?? "visits";
  const def = TABLES[key];
  if (!def) {
    return NextResponse.json({ error: `Tabela desconhecida: ${key}`, use: Object.keys(TABLES) }, { status: 400 });
  }
  const days = Math.max(1, Math.min(365, Number(url.searchParams.get("dias") ?? 30) || 30));

  try {
    const result = await pool.query(def.sql, [days]);
    const filename = `${def.file}-${url.searchParams.get("dias") ? `${days}d-` : ""}${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    return new NextResponse(toCsv(result.rows as Record<string, unknown>[]), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: `Não consegui exportar (${key}).`,
        detail,
        dica:
          detail.includes("does not exist") || detail.includes("relation")
            ? "Rode /api/admin/setup?token=SEU_TOKEN para criar as tabelas novas."
            : undefined,
      },
      { status: 500 },
    );
  }
}
