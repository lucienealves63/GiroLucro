import { Resend } from "resend";
import { maskEmail } from "@/lib/password-reset";
import { BUSINESS_INFO } from "@/lib/business-info";

/**
 * Envio de e-mail transacional (Resend) — usado pelas rotas de conta:
 * confirmação de pedido de reembolso, resposta a solicitações de titular de
 * dados e aviso de exclusão de conta.
 *
 * Nunca lança: se o e-mail não estiver configurado ou o provedor falhar, a
 * operação principal (feita no banco) continua válida e registramos o motivo.
 */

export type MailResult = { sent: boolean; error: string | null };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
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
    return entities[char] ?? char;
  });
}

function layout(title: string, inner: string): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#050608;font-family:Arial,sans-serif;color:#e4e4e7">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050608;padding:28px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#101319;border:1px solid #272b32;border-radius:20px;padding:26px">
<tr><td>
<p style="margin:0 0 18px;font-size:19px;font-weight:800;color:#f4f4f5">Giro<span style="color:#b8f53c">Lucro</span></p>
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.25;color:#fafafa">${title}</h1>
${inner}
<p style="margin:24px 0 0;border-top:1px solid #272b32;padding-top:16px;font-size:11.5px;line-height:1.6;color:#71717a">
${escapeHtml(BUSINESS_INFO.businessName)} — ${escapeHtml(BUSINESS_INFO.supportEmail)}.
Você recebe este e-mail porque existe uma conta com este endereço no GiroLucro.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn(
      "[email] RESEND_API_KEY/EMAIL_FROM ausentes — e-mail não enviado para",
      maskEmail(to),
    );
    return { sent: false, error: "email_not_configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from, to: [to], subject, html, text });
    if (error) {
      console.error("[email] Resend recusou o envio para", maskEmail(to), "|", error.message);
      return { sent: false, error: error.message };
    }
    console.info("[email] enviado para", maskEmail(to), "|", subject.slice(0, 60));
    return { sent: true, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[email] falha de rede no Resend:", message);
    return { sent: false, error: message };
  }
}

/** Confirmação do pedido de arrependimento/reembolso (CDC art. 49). */
export function refundRequestEmail(params: {
  firstName: string;
  amount: number | null;
  paidAt: Date | null;
  automatic: boolean;
  refunded: boolean;
}): { subject: string; html: string; text: string } {
  const money =
    params.amount === null
      ? "valor pago"
      : params.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const date = params.paidAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(
        params.paidAt,
      )
    : "—";
  const status = params.refunded
    ? "O reembolso foi solicitado ao Mercado Pago e o acesso Pro foi encerrado. O prazo para o valor aparecer na sua conta ou na fatura é definido pela operadora do cartão ou pelo seu banco."
    : params.automatic
      ? "Estamos processando o reembolso no Mercado Pago. O acesso Pro foi encerrado e você recebe uma nova confirmação quando o valor for devolvido."
      : "Seu pedido foi registrado para análise manual da nossa equipe. Responderemos pelo e-mail da conta com a decisão e, se aprovado, o reembolso é feito pelo mesmo meio de pagamento.";

  const title = "Recebemos seu pedido de reembolso.";
  const inner = `
    <p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#a1a1aa">
      Olá, ${escapeHtml(params.firstName)}. Registramos sua solicitação de arrependimento da compra do GiroLucro Pro.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;margin-bottom:14px">
      <tr><td style="padding:6px 0;color:#71717a;width:130px">Produto</td><td style="color:#f4f4f5;font-weight:700">GiroLucro Pro — pagamento único</td></tr>
      <tr><td style="padding:6px 0;color:#71717a">Valor</td><td style="color:#f4f4f5;font-weight:700">${escapeHtml(money)}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a">Data da compra</td><td style="color:#f4f4f5">${escapeHtml(date)}</td></tr>
    </table>
    <p style="margin:0;font-size:14px;line-height:1.65;color:#a1a1aa">${escapeHtml(status)}</p>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#71717a">
      Precisa falar com a gente? Responda este e-mail ou escreva para ${escapeHtml(BUSINESS_INFO.supportEmail)}.
    </p>`;
  const text = [
    title,
    "",
    `Produto: GiroLucro Pro — pagamento único`,
    `Valor: ${money}`,
    `Data da compra: ${date}`,
    "",
    status,
    "",
    `Contato: ${BUSINESS_INFO.supportEmail}`,
  ].join("\n");

  return { subject: "Recebemos seu pedido de reembolso — GiroLucro", html: layout(title, inner), text };
}

/** Decisão da equipe sobre um pedido de reembolso (fila manual). */
export function refundOutcomeEmail(params: {
  firstName: string;
  amount: number | null;
  approved: boolean;
}): { subject: string; html: string; text: string } {
  const money =
    params.amount === null
      ? "o valor pago"
      : params.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const title = params.approved
    ? "Seu reembolso foi aprovado."
    : "Sobre o seu pedido de reembolso.";
  const detail = params.approved
    ? `Fizemos a devolução de ${money} pelo mesmo meio de pagamento da compra. O acesso ao GiroLucro Pro foi encerrado. O prazo para o valor aparecer na conta ou na fatura é definido pelo seu banco ou pela operadora do cartão.`
    : `Analisamos o seu pedido e, neste caso, não foi possível aprovar o reembolso. O acesso ao GiroLucro Pro continua ativo. Se você discordar ou tiver informações novas, responda este e-mail que a gente revisa — e, se preferir, você pode excluir a conta a qualquer momento em Configurações → Privacidade e meus dados.`;
  const inner = `
    <p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#a1a1aa">
      Olá, ${escapeHtml(params.firstName)}.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.65;color:#a1a1aa">${escapeHtml(detail)}</p>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#71717a">
      Dúvidas? Escreva para ${escapeHtml(BUSINESS_INFO.supportEmail)}.
    </p>`;
  const text = [title, "", detail, "", `Contato: ${BUSINESS_INFO.supportEmail}`].join("\n");
  return { subject: `${title} — GiroLucro`, html: layout(title, inner), text };
}

/** Aviso pedido de exclusão de conta / confirmação do que foi removido. */
export function accountDeletionEmail(params: {
  firstName: string;
  anonymized: boolean;
}): { subject: string; html: string; text: string } {
  const title = "Sua conta do GiroLucro foi excluída.";
  const detail = params.anonymized
    ? "Apagamos seus dados pessoais e operacionais. Mantivemos apenas o registro mínimo da compra (data, valor e identificador da transação), exigido para guarda fiscal e defesa de direitos — sem seu nome, e-mail ou senha."
    : "Apagamos seus dados pessoais e operacionais do GiroLucro. Não há registro de compra vinculado a esta conta, então nada ficou guardado.";
  const inner = `
    <p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#a1a1aa">
      Olá, ${escapeHtml(params.firstName)}. Sua solicitação de exclusão foi executada e todas as sessões foram encerradas.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.65;color:#a1a1aa">${escapeHtml(detail)}</p>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#71717a">
      Se você não pediu isso, escreva agora para ${escapeHtml(BUSINESS_INFO.supportEmail)}.
    </p>`;
  const text = [title, "", detail, "", `Contato: ${BUSINESS_INFO.supportEmail}`].join("\n");
  return { subject: "Sua conta do GiroLucro foi excluída", html: layout(title, inner), text };
}
