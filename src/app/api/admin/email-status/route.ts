import { NextResponse } from "next/server";
import { Resend } from "resend";
import { pool } from "@/db";
import { getAppUrl, getAppUrlSource } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico da recuperação de senha — 100% pelo navegador.
 *
 *   https://SEU-DOMINIO/api/admin/email-status?token=SEU_ADMIN_SETUP_TOKEN
 *
 * Mostra o que está faltando para o e-mail de recuperação chegar:
 * variáveis de ambiente, tabela do banco, validade da chave do Resend
 * e os próximos passos em português. Protegida pelo mesmo token do setup.
 */

type Check = { label: string; status: "ok" | "warn" | "erro"; detail: string };

function maskKey(key: string): string {
  if (key.length <= 7) return "***";
  return `${key.slice(0, 3)}…${key.slice(-4)}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[char];
  });
}

function page(checks: Check[], nextSteps: string[], token: string): string {
  const tag = (s: Check["status"]) =>
    s === "ok"
      ? `<span class="ok-tag">OK ✓</span>`
      : s === "warn"
        ? `<span class="skip-tag">ATENÇÃO</span>`
        : `<span class="err-tag">FALHA</span>`;
  const rows = checks
    .map(
      (c) =>
        `<li><div><b>${escapeHtml(c.label)}</b><p>${escapeHtml(c.detail)}</p></div>${tag(c.status)}</li>`,
    )
    .join("");
  const steps = nextSteps
    .map((s, i) => `<li><div><b>${i + 1}.</b><p>${escapeHtml(s)}</p></div></li>`)
    .join("");
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GiroLucro — Diagnóstico de e-mail</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #08090c; color: #e4e4e7; font-family: -apple-system, system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 560px; width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 20px; padding: 28px; }
    h1 { font-size: 20px; font-weight: 800; }
    h1 span { color: #b8f53c; }
    .sub { margin-top: 4px; font-size: 13px; color: #a1a1aa; }
    h2 { margin: 22px 0 6px; font-size: 13px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #71717a; }
    ul { list-style: none; }
    li { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13.5px; }
    li b { font-weight: 700; }
    li p { margin-top: 3px; font-size: 12px; line-height: 1.55; color: #a1a1aa; word-break: break-word; }
    .ok-tag { color: #b8f53c; font-weight: 700; font-size: 12px; white-space: nowrap; }
    .skip-tag { color: #fbbf24; font-weight: 700; font-size: 12px; white-space: nowrap; }
    .err-tag { color: #fb7185; font-weight: 700; font-size: 12px; white-space: nowrap; }
    .next { display: block; text-align: center; margin-top: 20px; background: #b8f53c; color: #08090c; font-weight: 800; padding: 14px; border-radius: 14px; text-decoration: none; font-size: 14px; }
    .ghost { display: block; text-align: center; margin-top: 10px; border: 1px solid rgba(255,255,255,0.12); color: #e4e4e7; font-weight: 700; padding: 13px; border-radius: 14px; text-decoration: none; font-size: 13.5px; }
    .hint { margin-top: 16px; font-size: 11.5px; color: #71717a; line-height: 1.6; }
    code { background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 6px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Giro<span>Lucro</span> — e-mail de recuperação</h1>
    <p class="sub">Diagnóstico do envio de tokens de redefinição de senha.</p>
    <h2>Verificações</h2>
    <ul>${rows}</ul>
    <h2>Próximos passos</h2>
    <ul>${steps}</ul>
    <a class="next" href="/api/admin/test-email?token=${encodeURIComponent(token)}">Enviar um e-mail de teste →</a>
    <a class="ghost" href="/api/admin/email-status?token=${encodeURIComponent(token)}&amp;format=json">Ver como JSON</a>
    <p class="hint">Depois de ajustar variáveis na Vercel, clique em <b>Deployments → Redeploy</b> e abra esta página de novo. Nunca compartilhe o link com o token.</p>
  </div>
</body>
</html>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const expected = process.env.ADMIN_SETUP_TOKEN || "girolucro-setup";

  if (token !== expected) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const checks: Check[] = [];
  const nextSteps: string[] = [];

  // 1. RESEND_API_KEY
  const apiKey = process.env.RESEND_API_KEY || "";
  if (!apiKey) {
    checks.push({
      label: "RESEND_API_KEY",
      status: "erro",
      detail: "Não configurada. Sem ela, nenhum e-mail de recuperação é enviado.",
    });
    nextSteps.push(
      "Na Vercel (Settings → Environment Variables), crie RESEND_API_KEY com a chave gerada em resend.com → API Keys, marcando Production, Preview e Development.",
    );
  } else if (!apiKey.startsWith("re_")) {
    checks.push({
      label: "RESEND_API_KEY",
      status: "warn",
      detail: `Configurada (${maskKey(apiKey)}), mas não começa com "re_" — confira se copiou a chave certa.`,
    });
    nextSteps.push("Confira se a RESEND_API_KEY foi copiada por completo do painel do Resend.");
  } else {
    checks.push({
      label: "RESEND_API_KEY",
      status: "ok",
      detail: `Configurada (${maskKey(apiKey)}). Validade testada abaixo.`,
    });
  }

  // 2. EMAIL_FROM
  const emailFrom = process.env.EMAIL_FROM || "";
  if (!emailFrom) {
    checks.push({
      label: "EMAIL_FROM",
      status: "erro",
      detail: "Não configurada. Sem remetente, o envio é bloqueado.",
    });
    nextSteps.push(
      "Crie EMAIL_FROM na Vercel, ex.: GiroLucro <contato@seudominio.com.br> — usando um domínio verificado no Resend.",
    );
  } else {
    const lower = emailFrom.toLowerCase();
    const freeProvider = ["@gmail.", "@hotmail.", "@outlook.", "@yahoo.", "@icloud."].some((d) =>
      lower.includes(d),
    );
    if (lower.includes("resend.dev")) {
      checks.push({
        label: "EMAIL_FROM",
        status: "warn",
        detail: `${emailFrom} — remetente de teste: o Resend só entrega para o e-mail dono da conta. Usuários reais NÃO recebem.`,
      });
      nextSteps.push(
        "Para usuários reais receberem, verifique seu domínio em resend.com → Domains e troque EMAIL_FROM para um endereço desse domínio.",
      );
    } else if (freeProvider) {
      checks.push({
        label: "EMAIL_FROM",
        status: "warn",
        detail: `${emailFrom} — provedores gratuitos (@gmail etc.) não passam na verificação do Resend e o e-mail pode ser recusado.`,
      });
      nextSteps.push("Use um remetente do seu próprio domínio verificado no Resend.");
    } else {
      checks.push({ label: "EMAIL_FROM", status: "ok", detail: emailFrom });
    }
  }

  // 3. APP_URL
  const appUrl = getAppUrl(req);
  const appSource = getAppUrlSource();
  if (appSource === "APP_URL" || appSource === "NEXT_PUBLIC_APP_URL") {
    checks.push({
      label: "APP_URL",
      status: "ok",
      detail: `${appUrl} (origem: ${appSource}). Os links do e-mail apontam para este endereço.`,
    });
  } else {
    checks.push({
      label: "APP_URL",
      status: "warn",
      detail: `${appUrl} (origem: ${appSource}). Defina APP_URL com o endereço definitivo de produção para os links sempre abrirem certo.`,
    });
    nextSteps.push("Crie APP_URL na Vercel com o endereço de produção, ex.: https://app.seudominio.com.br.");
  }

  // 4. Tabela password_reset_tokens
  try {
    const r = await pool.query("SELECT to_regclass($1) AS reg", [
      "public.password_reset_tokens",
    ]);
    if (r.rows[0]?.reg) {
      checks.push({
        label: "Tabela password_reset_tokens",
        status: "ok",
        detail: "Existe no banco. Solicitações de recuperação estão sendo registradas.",
      });
      try {
        const stats = await pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE created_at > now() - interval '1 hour') AS ultima_hora,
             COUNT(*) FILTER (WHERE used_at IS NULL AND expires_at > now()) AS validos_agora
           FROM password_reset_tokens`,
        );
        const row = stats.rows[0] as { ultima_hora: string; validos_agora: string };
        checks.push({
          label: "Movimento recente",
          status: "ok",
          detail: `${row.ultima_hora} solicitação(ões) na última hora · ${row.validos_agora} link(s) válido(s) agora.`,
        });
      } catch {
        // Estatística é opcional — tabela existe, segue o jogo.
      }
    } else {
      checks.push({
        label: "Tabela password_reset_tokens",
        status: "erro",
        detail: "NÃO existe no banco — toda solicitação de recuperação falha em silêncio.",
      });
      nextSteps.push(
        "Abra /api/admin/setup?token=SEU_TOKEN no navegador para criar a tabela password_reset_tokens (não apaga nada).",
      );
    }
  } catch (e) {
    checks.push({
      label: "Tabela password_reset_tokens",
      status: "erro",
      detail: `Não foi possível consultar o banco: ${(e instanceof Error && e.message) || String(e) || "erro de conexão"}`,
    });
    nextSteps.push("Confira a DATABASE_URL na Vercel e se o banco Neon está ativo.");
  }

  // 5. Validade da chave no Resend (lista domínios — não envia e-mail, não gasta cota).
  if (apiKey) {
    try {
      const resend = new Resend(apiKey);
      const probe = await Promise.race([
        resend.domains.list(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("tempo esgotado (12s)")), 12_000),
        ),
      ]);
      if (probe.error) {
        checks.push({
          label: "Chave válida no Resend?",
          status: "erro",
          detail: `O Resend recusou a chave: ${probe.error.message}`,
        });
        nextSteps.push(
          "Gere uma nova chave em resend.com → API Keys, atualize RESEND_API_KEY na Vercel e faça Redeploy.",
        );
      } else {
        const raw = probe.data as unknown;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as { data?: unknown })?.data)
            ? ((raw as { data: unknown[] }).data as Array<{ name?: string; status?: string }>)
            : [];
        const verified = list.filter((d) => d?.status === "verified").length;
        checks.push({
          label: "Chave válida no Resend?",
          status: "ok",
          detail:
            list.length === 0
              ? "Sim — chave aceita. Nenhum domínio encontrado: verifique seu domínio em resend.com → Domains."
              : `Sim — chave aceita. ${verified}/${list.length} domínio(s) verificado(s).`,
        });
        if (verified === 0 && list.length > 0) {
          nextSteps.push(
            "Complete a verificação do domínio no Resend (registros DNS) — sem domínio verificado, o envio para usuários reais falha.",
          );
        }
      }
    } catch (e) {
      checks.push({
        label: "Chave válida no Resend?",
        status: "warn",
        detail: `Não foi possível validar agora: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  if (nextSteps.length === 0) {
    nextSteps.push(
      "Tudo certo por aqui! Se um usuário específico não recebe, peça para conferir Spam/Lixo eletrônico e a aba Promoções, e use o botão de e-mail de teste abaixo com o endereço dele.",
    );
  }

  if (url.searchParams.get("format") === "json") {
    return NextResponse.json({
      ok: !checks.some((c) => c.status === "erro"),
      appUrl,
      appUrlSource: appSource,
      resendApiKey: apiKey ? maskKey(apiKey) : null,
      emailFrom: emailFrom || null,
      checks,
      nextSteps,
    });
  }

  return new NextResponse(page(checks, nextSteps, token), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
