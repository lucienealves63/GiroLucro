import { NextResponse } from "next/server";
import { pool } from "@/db";
import { getAppUrl, getAppUrlSource, maskEmail } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico do pagamento — 100% pelo navegador.
 *
 *   https://SEU-DOMINIO/api/admin/billing-status?token=SEU_ADMIN_SETUP_TOKEN
 *
 * Mostra o que está faltando para assinaturas e Pix funcionarem:
 * variáveis de ambiente, validade do Access Token do Mercado Pago,
 * URL pública e tabela de eventos. Protegida pelo mesmo token do setup.
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
  <title>GiroLucro — Diagnóstico de pagamento</title>
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
    <h1>Giro<span>Lucro</span> — pagamento</h1>
    <p class="sub">Diagnóstico do Mercado Pago (assinatura e Pix à vista).</p>
    <h2>Verificações</h2>
    <ul>${rows}</ul>
    <h2>Próximos passos</h2>
    <ul>${steps}</ul>
    <a class="ghost" href="/api/admin/billing-status?token=${encodeURIComponent(token)}&amp;format=json">Ver como JSON</a>
    <p class="hint">Depois de ajustar variáveis na Vercel, clique em <b>Deployments → Redeploy</b> e abra esta página de novo. Nunca compartilhe este link com o token.</p>
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
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";

  // 1. MERCADO_PAGO_ACCESS_TOKEN
  if (!accessToken) {
    checks.push({
      label: "MERCADO_PAGO_ACCESS_TOKEN",
      status: "erro",
      detail: "Não configurada. Sem ela, nenhum checkout de assinatura ou Pix é criado.",
    });
    nextSteps.push(
      "Na Vercel (Settings → Environment Variables), crie MERCADO_PAGO_ACCESS_TOKEN com o Access Token de produção do Mercado Pago (começa com APP_USR-).",
    );
  } else if (accessToken.startsWith("APP_USR-")) {
    checks.push({
      label: "MERCADO_PAGO_ACCESS_TOKEN",
      status: "ok",
      detail: `Configurada (${maskKey(accessToken)}). Parece uma credencial de produção.`,
    });
  } else if (accessToken.startsWith("TEST-")) {
    checks.push({
      label: "MERCADO_PAGO_ACCESS_TOKEN",
      status: "warn",
      detail: `Configurada (${maskKey(accessToken)}), mas é uma credencial de teste (TEST-). Serve apenas para usuários de teste do Mercado Pago.`,
    });
    nextSteps.push(
      "Para produção, substitua por uma credencial APP_USR- obtida em Mercado Pago → Suas integrações → Credenciais de produção.",
    );
  } else {
    checks.push({
      label: "MERCADO_PAGO_ACCESS_TOKEN",
      status: "warn",
      detail: `Configurada (${maskKey(accessToken)}), mas não começa com APP_USR- ou TEST-. Pode ser uma Public Key — use o Access Token nesta variável.`,
    });
    nextSteps.push("Confirme se copiou o Access Token (não a Public Key) da aplicação do Mercado Pago.");
  }

  // 2. Validade real do Access Token
  let maskedAccount: string | null = null;
  if (accessToken) {
    try {
      const res = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) {
        const body = (await res.json().catch(() => null)) as { email?: string } | null;
        maskedAccount = body?.email ? maskEmail(body.email) : null;
        checks.push({
          label: "Access Token válido?",
          status: "ok",
          detail: `Sim — a API aceitou o token${
            maskedAccount ? ` (conta ${maskedAccount})` : ""
          }.`,
        });
      } else if (res.status === 401 || res.status === 403) {
        checks.push({
          label: "Access Token válido?",
          status: "erro",
          detail: `Não — o Mercado Pago respondeu ${res.status} (token inválido/expirado).`,
        });
        nextSteps.push(
          "Gere um novo Access Token no painel do Mercado Pago, atualize MERCADO_PAGO_ACCESS_TOKEN na Vercel e faça Redeploy.",
        );
      } else {
        checks.push({
          label: "Access Token válido?",
          status: "warn",
          detail: `O Mercado Pago respondeu ${res.status} — não foi possível confirmar agora.`,
        });
        nextSteps.push("Confira a conexão com o Mercado Pago e tente novamente em instantes.");
      }
    } catch (e) {
      checks.push({
        label: "Access Token válido?",
        status: "warn",
        detail: `Não foi possível validar agora: ${e instanceof Error ? e.message : String(e)}`,
      });
      nextSteps.push("Confira se o Mercado Pago está acessível a partir da Vercel e tente novamente.");
    }
  }

  // 3. MERCADO_PAGO_WEBHOOK_SECRET
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || "";
  if (!webhookSecret) {
    checks.push({
      label: "MERCADO_PAGO_WEBHOOK_SECRET",
      status: "warn",
      detail: "Não configurada. A assinatura Criar/Editar ainda funciona, mas a confirmação automática pelo webhook será recusada.",
    });
    nextSteps.push(
      "No painel do Mercado Pago, abra Webhooks/Notificações, copie a assinatura secreta e crie MERCADO_PAGO_WEBHOOK_SECRET na Vercel.",
    );
  } else {
    checks.push({
      label: "MERCADO_PAGO_WEBHOOK_SECRET",
      status: "ok",
      detail: "Configurada. Os webhooks podem validar a assinatura HMAC.",
    });
  }

  // 4. APP_URL
  const appUrl = getAppUrl(req);
  const appSource = getAppUrlSource();
  if (appSource === "APP_URL" || appSource === "NEXT_PUBLIC_APP_URL") {
    checks.push({
      label: "APP_URL",
      status: "ok",
      detail: `${appUrl} (origem: ${appSource}). Usada como URL de notificação do Pix.`,
    });
  } else {
    checks.push({
      label: "APP_URL",
      status: "warn",
      detail: `${appUrl} (origem: ${appSource}). Defina APP_URL com o endereço definitivo de produção.`,
    });
    nextSteps.push("Crie APP_URL na Vercel com o endereço de produção, ex.: https://app.seudominio.com.br.");
  }

  // 5. Tabela billing_events
  try {
    const r = await pool.query("SELECT to_regclass($1) AS reg", ["public.billing_events"]);
    if (r.rows[0]?.reg) {
      checks.push({
        label: "Tabela billing_events",
        status: "ok",
        detail: "Existe no banco. Reenvios de webhook não duplicam ativações.",
      });
    } else {
      checks.push({
        label: "Tabela billing_events",
        status: "erro",
        detail: "NÃO existe no banco — o webhook não consegue impedir processamento duplicado.",
      });
      nextSteps.push(
        "Abra /api/admin/setup?token=SEU_TOKEN no navegador para criar a tabela billing_events (não apaga nada).",
      );
    }
  } catch (e) {
    checks.push({
      label: "Tabela billing_events",
      status: "erro",
      detail: `Não foi possível consultar o banco: ${
        (e instanceof Error && e.message) || String(e) || "erro de conexão"
      }`,
    });
    nextSteps.push("Confira a DATABASE_URL na Vercel e se o banco Neon está ativo.");
  }

  if (nextSteps.length === 0) {
    nextSteps.push(
      "Tudo certo por aqui! Nos testes, nunca use o e-mail da conta vendedora como comprador — crie um comprador de teste no painel do Mercado Pago.",
    );
  } else {
    nextSteps.push(
      "Lembrete: em testes, não use o e-mail da conta vendedora como comprador. Use um usuário comprador de teste do Mercado Pago.",
    );
  }

  if (url.searchParams.get("format") === "json") {
    return NextResponse.json({
      ok: !checks.some((c) => c.status === "erro"),
      appUrl,
      appUrlSource: appSource,
      mercadoPagoAccessToken: accessToken ? maskKey(accessToken) : null,
      mercadoPagoWebhookSecret: webhookSecret ? "configurado" : null,
      maskedAccount,
      checks,
      nextSteps,
    });
  }

  return new NextResponse(page(checks, nextSteps, token), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
