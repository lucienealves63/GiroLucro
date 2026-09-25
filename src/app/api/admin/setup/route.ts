import { NextResponse } from "next/server";
import { pool } from "@/db";
import type { SetupKind } from "@/db/schema-ensure";
import { alreadyExists, STATEMENTS } from "@/db/schema-ensure";

export const dynamic = "force-dynamic";

/**
 * Setup do banco de dados via navegador — sem terminal, sem CLI.
 *
 * IMPORTANTE: desde que o deploy automático aplica as atualizações de schema
 * (ver `src/instrumentation.ts` → `ensureSchema()`), este link é apenas
 * diagnóstico/reexecução manual — útil para conferir o que existe no banco
 * ou para forçar a aplicação se algo falhou.
 *
 * Se precisar usá-lo:
 *   https://SEU-DOMINIO/api/admin/setup?token=SEU_TOKEN
 *
 * O token é a variável de ambiente ADMIN_SETUP_TOKEN
 * (padrão: "girolucro-setup" — troque em produção!).
 *
 * É idempotente: rodar duas vezes não quebra nada
 * (tabelas/colunas/índices existentes são detectados).
 */

function tagLabel(kind: SetupKind, created: boolean): { css: string; text: string } {
  if (!created) {
    return { css: "skip-tag", text: kind === "data" ? "JÁ APLICADO" : "JÁ EXISTIA" };
  }
  if (kind === "column") return { css: "ok-tag", text: "COLUNA ✓" };
  if (kind === "index") return { css: "ok-tag", text: "ÍNDICE ✓" };
  if (kind === "data") return { css: "ok-tag", text: "APLICADO ✓" };
  return { css: "ok-tag", text: "CRIADA ✓" };
}

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
    li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13.5px; }
    li b { font-weight: 600; word-break: break-all; }
    .ok-tag { color: #b8f53c; font-weight: 700; font-size: 12px; white-space: nowrap; }
    .skip-tag { color: #fbbf24; font-weight: 700; font-size: 12px; white-space: nowrap; }
    .err-tag { color: #fb7185; font-weight: 700; font-size: 12px; white-space: nowrap; }
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
      Cada tabela/coluna já é criada com segurança: rodar duas vezes não tem problema.
      A coluna <code>settings.platforms_json</code> habilita apps personalizados.
      A coluna <code>users.is_test</code> marca contas de teste (acesso liberado sem
      cobrança e fora das métricas) — a conta administrativa é marcada automaticamente.
      As tabelas <code>page_views</code> e <code>contact_messages</code> ligam o painel de acessos
      (<code>/admin</code>) e o formulário de contato (<code>/contato</code>).
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
      const exists = await alreadyExists(st);
      await pool.query(st.sql);

      // Re-checa colunas após o ALTER (ADD IF NOT EXISTS)
      const existsAfter = st.kind === "column" ? await alreadyExists(st) : exists;
      const wasCreated = st.kind === "column" ? !exists && existsAfter : !exists;

      if (wasCreated) {
        created++;
        const tag = tagLabel(st.kind, true);
        results.push(`<li><b>${st.name}</b><span class="${tag.css}">${tag.text}</span></li>`);
      } else {
        skipped++;
        const tag = tagLabel(st.kind, false);
        results.push(`<li><b>${st.name}</b><span class="${tag.css}">${tag.text}</span></li>`);
      }
    } catch (e: unknown) {
      failed++;
      const message = e instanceof Error ? e.message : String(e);
      results.push(
        `<li><b>${st.name}</b><span class="err-tag">ERRO</span></li>`,
      );
      console.error(`Setup [${st.name}]:`, message);
    }
  }

  const ok = failed === 0;
  const title = ok
    ? `Setup concluído! ${created} nova(s), ${skipped} já existiam.`
    : `${failed} erro(s) no setup — confira a DATABASE_URL`;

  return new NextResponse(page(title, results.join(""), ok), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
