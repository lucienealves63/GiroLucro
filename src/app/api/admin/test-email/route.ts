import { NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

/**
 * Envia um e-mail de teste com a MESMA configuração da recuperação de senha.
 *
 *   https://SEU-DOMINIO/api/admin/test-email?token=SEU_TOKEN&to=voce@email.com
 *
 * Sem o parâmetro "to", exibe um formulário simples. Protegida pelo token do setup.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function page(opts: {
  token: string;
  to: string;
  sent: boolean | null;
  detail: string | null;
}): string {
  const result =
    opts.sent === null
      ? ""
      : opts.sent
        ? `<p class="title ok">E-mail enviado! ✓</p><p class="sub">${escapeHtml(opts.detail ?? "")}</p>`
        : `<p class="title erro">Falha no envio</p><p class="sub">${escapeHtml(opts.detail ?? "")}</p>`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GiroLucro — Teste de e-mail</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #08090c; color: #e4e4e7; font-family: -apple-system, system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 480px; width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 20px; padding: 28px; }
    h1 { font-size: 20px; font-weight: 800; }
    h1 span { color: #b8f53c; }
    .sub { margin-top: 6px; font-size: 13px; line-height: 1.6; color: #a1a1aa; word-break: break-word; }
    .title { margin-top: 18px; font-size: 18px; font-weight: 800; }
    .title.ok { color: #b8f53c; }
    .title.erro { color: #fb7185; }
    form { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; }
    input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 14px; color: #f4f4f5; font-size: 15px; width: 100%; }
    button { background: #b8f53c; color: #08090c; font-weight: 800; padding: 14px; border: 0; border-radius: 14px; font-size: 15px; cursor: pointer; }
    .ghost { display: block; text-align: center; margin-top: 10px; border: 1px solid rgba(255,255,255,0.12); color: #e4e4e7; font-weight: 700; padding: 13px; border-radius: 14px; text-decoration: none; font-size: 13.5px; }
    .hint { margin-top: 16px; font-size: 11.5px; color: #71717a; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Giro<span>Lucro</span> — teste de e-mail</h1>
    <p class="sub">Envia com o mesmo remetente e chave da recuperação de senha. Confira a caixa de entrada (e o Spam) do endereço testado.</p>
    ${result}
    <form method="get" action="/api/admin/test-email">
      <input type="hidden" name="token" value="${escapeHtml(opts.token)}" />
      <input type="email" name="to" required placeholder="voce@email.com" value="${escapeHtml(opts.to)}" autocomplete="email" />
      <button type="submit">Enviar e-mail de teste</button>
    </form>
    <a class="ghost" href="/api/admin/email-status?token=${encodeURIComponent(opts.token)}">← Voltar ao diagnóstico</a>
    <p class="hint">Se o teste chegar mas a recuperação não, o problema costuma ser o endereço do usuário (digitou errado, caixa cheia ou filtro anti-spam).</p>
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

  const to = (url.searchParams.get("to") ?? "").trim().toLowerCase().slice(0, 254);
  const asJson = url.searchParams.get("format") === "json";

  if (!to) {
    if (asJson) return NextResponse.json({ error: 'Informe o parâmetro "to".' }, { status: 400 });
    return new NextResponse(page({ token, to: "", sent: null, detail: null }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  if (!EMAIL_RE.test(to)) {
    if (asJson) return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    return new NextResponse(page({ token, to, sent: false, detail: "E-mail inválido." }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    const detail = !apiKey
      ? "RESEND_API_KEY não configurada na Vercel."
      : "EMAIL_FROM não configurada na Vercel.";
    if (asJson) return NextResponse.json({ sent: false, error: detail }, { status: 500 });
    return new NextResponse(page({ token, to, sent: false, detail }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      subject: "GiroLucro — teste de e-mail ✓",
      text: "Se você recebeu esta mensagem, o envio de e-mails do GiroLucro (inclusive a recuperação de senha) está funcionando.",
      html: `<p style="font-family:Arial,sans-serif;font-size:15px">Se você recebeu esta mensagem, o envio de e-mails do <b>GiroLucro</b> (inclusive a recuperação de senha) está funcionando. ✓</p>`,
    });
    if (error) {
      console.error("[password-reset] Teste de e-mail falhou:", error.message);
      if (asJson) return NextResponse.json({ sent: false, error: error.message });
      return new NextResponse(
        page({ token, to, sent: false, detail: `O Resend recusou: ${error.message}` }),
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }
    if (asJson) return NextResponse.json({ sent: true, messageId: data?.id });
    return new NextResponse(
      page({
        token,
        to,
        sent: true,
        detail: `Mensagem ${data?.id ?? ""} aceita pelo Resend. Confira a caixa de entrada de ${to} (e o Spam).`,
      }),
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[password-reset] Teste de e-mail falhou (rede):", message);
    if (asJson) return NextResponse.json({ sent: false, error: message }, { status: 500 });
    return new NextResponse(page({ token, to, sent: false, detail: message }), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
