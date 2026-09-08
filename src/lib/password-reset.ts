import { createHash, randomBytes } from "node:crypto";
import { Resend } from "resend";

export const PASSWORD_RESET_MINUTES = 30;

export function createPasswordResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashPasswordResetToken(token) };
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getAppUrl(req?: Request): string {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  const productionHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (productionHost) return `https://${productionHost.replace(/^https?:\/\//, "")}`;

  if (req && process.env.NODE_ENV !== "production") {
    return new URL(req.url).origin;
  }
  return "http://localhost:3000";
}

/** De onde veio a APP_URL resolvida — usado só no diagnóstico do admin. */
export function getAppUrlSource(): "APP_URL" | "NEXT_PUBLIC_APP_URL" | "VERCEL" | "FALLBACK_LOCALHOST" {
  if (process.env.APP_URL) return "APP_URL";
  if (process.env.NEXT_PUBLIC_APP_URL) return "NEXT_PUBLIC_APP_URL";
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL) return "VERCEL";
  return "FALLBACK_LOCALHOST";
}

/** Mascara um e-mail para logs (ex.: "m***@gmail.com") — nunca loga o endereço cheio. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const head = (local || "").slice(0, 1) || "*";
  return `${head}***@${domain}`;
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

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[password-reset] RESEND_API_KEY não configurada — e-mail NÃO enviado para",
      maskEmail(to),
      "| Configure RESEND_API_KEY na Vercel (Settings → Environment Variables) e faça Redeploy.",
    );
    return { sent: false, error: "email_not_configured" };
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    console.warn(
      "[password-reset] EMAIL_FROM não configurada — e-mail NÃO enviado para",
      maskEmail(to),
      "| Configure EMAIL_FROM na Vercel, ex.: GiroLucro <contato@seudominio.com.br>.",
    );
    return { sent: false, error: "email_from_not_configured" };
  }

  const resend = new Resend(apiKey);
  const safeName = escapeHtml(name.split(" ")[0] || "motorista");
  const safeUrl = escapeHtml(resetUrl);

  let result: Awaited<ReturnType<typeof resend.emails.send>>;
  try {
    result = await resend.emails.send({
    from,
    to: [to],
    subject: "Redefina sua senha do GiroLucro",
    html: `
      <!doctype html>
      <html lang="pt-BR">
        <body style="margin:0;background:#08090c;font-family:Arial,sans-serif;color:#e4e4e7">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#08090c;padding:32px 16px">
            <tr><td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#101319;border:1px solid #272b32;border-radius:22px;padding:30px">
                <tr><td>
                  <p style="margin:0 0 28px;font-size:20px;font-weight:800;color:#f4f4f5">Giro<span style="color:#b8f53c">Lucro</span></p>
                  <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#fafafa">Esqueceu a senha, ${safeName}?</h1>
                  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#a1a1aa">Recebemos uma solicitação para redefinir a senha da sua conta. O botão abaixo funciona por ${PASSWORD_RESET_MINUTES} minutos e só pode ser usado uma vez.</p>
                  <a href="${safeUrl}" style="display:block;background:#b8f53c;color:#08090c;text-decoration:none;text-align:center;font-size:15px;font-weight:800;padding:15px 20px;border-radius:14px">Criar uma nova senha</a>
                  <p style="margin:24px 0 8px;font-size:12px;color:#71717a">Se o botão não abrir, copie este endereço:</p>
                  <p style="margin:0;word-break:break-all;font-size:11px;line-height:1.5;color:#a1a1aa">${safeUrl}</p>
                  <p style="margin:28px 0 0;border-top:1px solid #272b32;padding-top:20px;font-size:12px;line-height:1.6;color:#71717a">Se você não pediu a troca, pode ignorar este e-mail. Sua senha continuará a mesma. Nunca compartilhe este link.</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
      </html>`,
    text: `Olá, ${name.split(" ")[0] || "motorista"}. Redefina sua senha do GiroLucro: ${resetUrl}\n\nO link expira em ${PASSWORD_RESET_MINUTES} minutos e só pode ser usado uma vez. Se você não fez esta solicitação, ignore este e-mail.`,
    });
  } catch (networkError) {
    // Falha de rede/timeout do Resend: trata como "não enviado" em vez de
    // estourar — assim a rota invalida o token órfão e registra o motivo.
    const message =
      networkError instanceof Error ? networkError.message : String(networkError);
    console.error(
      "[password-reset] Erro de rede ao chamar o Resend para",
      maskEmail(to),
      "|",
      message,
    );
    return { sent: false, error: `resend_network: ${message}` };
  }

  const { data, error } = result;
  if (error) {
    console.error(
      "[password-reset] Resend recusou o envio para",
      maskEmail(to),
      `| from=${from} |`,
      error.message,
    );
    return { sent: false, error: error.message };
  }

  console.info(
    "[password-reset] E-mail de recuperação enviado para",
    maskEmail(to),
    "| id=",
    data?.id ?? "?",
  );
  return { sent: true, messageId: data?.id };
}
