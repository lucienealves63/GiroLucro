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

  // Desenvolvimento sem chave: simula o envio para permitir testar recibo,
  // reembolso e lembretes de ponta a ponta. Nunca vale em produção.
  if (process.env.NODE_ENV !== "production" && process.env.EMAIL_DEV_MODE === "true") {
    console.info(`[email][dev] SIMULADO (nada foi enviado) → ${maskEmail(to)} | ${subject}`);
    console.info(`[email][dev] ${text.slice(0, 1400)}`);
    return { sent: true, error: null };
  }

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

/* ----------------------------- pós-venda -------------------------------- */

const money = (v: number | null, fallback = "valor pago"): string =>
  v === null || !Number.isFinite(v)
    ? fallback
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const brDate = (value: Date | null): string =>
  value && Number.isFinite(value.getTime())
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(value)
    : "—";

const PROVIDER_LABELS: Record<string, string> = {
  mercado_pago: "Mercado Pago",
  pix: "Pix (Mercado Pago)",
  demo: "Ambiente de demonstração",
};

/**
 * Recibo da compra do GiroLucro Pro (pagamento único), enviado quando o
 * pagamento é confirmado. Além do recibo, informa por escrito o prazo de
 * arrependimento — o CDC garante 7 dias e a pessoa precisa saber disso.
 */
export function purchaseReceiptEmail(params: {
  firstName: string;
  amount: number | null;
  paidAt: Date | null;
  paymentId: string | null;
  provider: string | null;
  refundDeadline: Date | null;
  settingsUrl: string;
}): { subject: string; html: string; text: string } {
  const title = "Compra confirmada: bem-vindo ao GiroLucro Pro.";
  const provider = PROVIDER_LABELS[params.provider ?? ""] ?? params.provider ?? "—";
  const inner = `
    <p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#a1a1aa">
      Olá, ${escapeHtml(params.firstName)}. Seu pagamento foi aprovado e o acesso ao GiroLucro Pro já está liberado nesta conta.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;margin-bottom:14px">
      <tr><td style="padding:6px 0;color:#71717a;width:150px">Produto</td><td style="color:#f4f4f5;font-weight:700">GiroLucro Pro — pagamento único</td></tr>
      <tr><td style="padding:6px 0;color:#71717a">Valor</td><td style="color:#f4f4f5;font-weight:700">${escapeHtml(money(params.amount))}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a">Pago em</td><td style="color:#f4f4f5">${escapeHtml(brDate(params.paidAt))}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a">Forma de pagamento</td><td style="color:#f4f4f5">${escapeHtml(provider)}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a">Identificador</td><td style="color:#f4f4f5">${escapeHtml(params.paymentId ?? "—")}</td></tr>
      <tr><td style="padding:6px 0;color:#71717a">Como é cobrado</td><td style="color:#f4f4f5">Uma vez só — sem mensalidade e sem renovação automática</td></tr>
    </table>
    <p style="margin:0;font-size:14px;line-height:1.65;color:#a1a1aa">
      <b style="color:#f4f4f5">Direito de arrependimento:</b> por lei (art. 49 do Código de Defesa do Consumidor) você pode desistir da compra em até 7 dias corridos e receber 100% do valor de volta. Nesta compra o prazo vai até <b style="color:#f4f4f5">${escapeHtml(brDate(params.refundDeadline))}</b>.
    </p>
    <p style="margin:16px 0 0;font-size:14px;line-height:1.65;color:#a1a1aa">
      Para usar ou para pedir o reembolso, entre em <b style="color:#f4f4f5">Configurações → Minha compra</b>:
      <a href="${escapeHtml(params.settingsUrl)}" style="color:#b8f53c;font-weight:700">${escapeHtml(params.settingsUrl)}</a>
    </p>
    <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#71717a">
      Também guardamos este recibo dentro do app, no mesmo lugar. Precisa de ajuda? Responda este e-mail ou escreva para ${escapeHtml(BUSINESS_INFO.supportEmail)} (${escapeHtml(BUSINESS_INFO.supportHours)}).
    </p>`;
  const text = [
    title,
    "",
    `Produto: GiroLucro Pro — pagamento único`,
    `Valor: ${money(params.amount)}`,
    `Pago em: ${brDate(params.paidAt)}`,
    `Forma de pagamento: ${provider}`,
    `Identificador: ${params.paymentId ?? "—"}`,
    "Como é cobrado: uma vez só — sem mensalidade e sem renovação automática",
    "",
    `Direito de arrependimento: você pode desistir em até 7 dias corridos e receber 100% do valor de volta. O prazo desta compra vai até ${brDate(params.refundDeadline)}.`,
    "",
    `Usar ou pedir reembolso: Configurações → Minha compra`,
    params.settingsUrl,
    "",
    `Contato: ${BUSINESS_INFO.supportEmail}`,
  ].join("\n");
  return { subject: "Compra confirmada — recibo do GiroLucro Pro", html: layout(title, inner), text };
}

/**
 * Lembrete de fim do prazo de arrependimento (enviado 2 dias antes de fechar).
 * É um aviso de transparência, não uma oferta: nada de insistência ou desconto.
 */
export function refundWindowReminderEmail(params: {
  firstName: string;
  amount: number | null;
  paidAt: Date | null;
  refundDeadline: Date | null;
  /** Quantos dias ainda faltam (1 = último dia). */
  daysLeft: number;
  settingsUrl: string;
}): { subject: string; html: string; text: string } {
  const prazo = params.daysLeft <= 1 ? "termina hoje" : `termina em ${params.daysLeft} dias`;
  const title =
    params.daysLeft <= 1
      ? "Hoje é o último dia para pedir reembolso, se quiser."
      : "O prazo para pedir reembolso está terminando.";
  const inner = `
    <p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#a1a1aa">
      Olá, ${escapeHtml(params.firstName)}. Sua compra do GiroLucro Pro (${escapeHtml(money(params.amount))}, em ${escapeHtml(brDate(params.paidAt))}) está com o prazo de arrependimento perto do fim.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.65;color:#a1a1aa">
      O prazo de arrependimento ${escapeHtml(prazo)}: você pode pedir
      <b style="color:#f4f4f5">100% do valor de volta</b> até
      <b style="color:#f4f4f5">${escapeHtml(brDate(params.refundDeadline))}</b>, sem precisar justificar nada
      (art. 49 do Código de Defesa do Consumidor).
    </p>
    <p style="margin:16px 0 0;font-size:14px;line-height:1.65;color:#a1a1aa">
      Se quiser fazer o pedido, é em <b style="color:#f4f4f5">Configurações → Minha compra</b>:
      <a href="${escapeHtml(params.settingsUrl)}" style="color:#b8f53c;font-weight:700">${escapeHtml(params.settingsUrl)}</a>
    </p>
    <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#71717a">
      E se estiver tudo certo com o app, ignore este e-mail: sua conta continua ativa e nada muda. Dúvidas? Escreva para ${escapeHtml(BUSINESS_INFO.supportEmail)}.
    </p>`;
  const text = [
    title,
    "",
    `Compra: GiroLucro Pro — pagamento único, ${money(params.amount)}, em ${brDate(params.paidAt)}.`,
    `Prazo de arrependimento (100% do valor de volta) ${prazo}, até ${brDate(params.refundDeadline)} — sem precisar justificar.`,
    "",
    "Pedir reembolso: Configurações → Minha compra",
    params.settingsUrl,
    "",
    "Se estiver tudo certo com o app, ignore este e-mail: sua conta continua ativa e nada muda.",
    `Contato: ${BUSINESS_INFO.supportEmail}`,
  ].join("\n");
  return {
    subject:
      params.daysLeft <= 1
        ? "Último dia do prazo de reembolso — GiroLucro"
        : `Reembolso: faltam ${params.daysLeft} dias — GiroLucro`,
    html: layout(title, inner),
    text,
  };
}
