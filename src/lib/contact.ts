import { createHash } from "node:crypto";
import { Resend } from "resend";
import { maskEmail } from "@/lib/password-reset";

/**
 * Contato — tema, validação e envio de e-mail.
 *
 * Regra de ouro: a mensagem SEMPRE é salva no banco (aparece em
 * /admin?aba=contato). O e-mail é só uma cópia; se o Resend não estiver
 * configurado ou estiver com erro, nada se perde.
 */

export { CONTACT_TOPICS, CONTACT_TOPIC_IDS, topicLabel } from "@/lib/contact-topics";
import { CONTACT_TOPIC_IDS, topicLabel } from "@/lib/contact-topics";

export type ContactInput = {
  name: string;
  email: string;
  phone: string | null;
  topic: string;
  body: string;
  replyToEmail: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type ValidateResult = { ok: true; value: ContactInput } | { ok: false; error: string };

export function validateContact(raw: Record<string, unknown>): ValidateResult {
  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.replace(/\r/g, "").trim().slice(0, max) : "";

  const name = str(raw.name, 60);
  const email = str(raw.email, 120).toLowerCase();
  const phone = str(raw.phone, 24) || null;
  const body = str(raw.body, 4000);
  const topic = CONTACT_TOPIC_IDS.includes(str(raw.topic, 20)) ? str(raw.topic, 20) : "outro";
  const replyToEmail = raw.replyToEmail === true || raw.replyToEmail === "on" || raw.replyToEmail === "1";

  if (name.length < 2) return { ok: false, error: "Diga seu nome (pelo menos 2 letras)." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "E-mail inválido — confira para conseguirmos responder." };
  if (body.length < 12) return { ok: false, error: "Escreva pelo menos uma frase (12 caracteres)." };
  if (body.length > 4000) return { ok: false, error: "Mensagem muito longa (máximo 4000 caracteres)." };
  // evita link/spam no corpo
  if ((body.match(/https?:\/\//gi) ?? []).length > 3) {
    return { ok: false, error: "Muitos links na mensagem — descreva seu caso sem colar endereços." };
  }
  return { ok: true, value: { name, email, phone, topic, body, replyToEmail } };
}

/** Hash com salt: permite frear abuso por IP sem guardar o IP em si. */
export function hashIp(ip: string): string {
  const salt = process.env.ADMIN_SETUP_TOKEN || "girolucro";
  return createHash("sha256").update(`${salt}|${ip}`).digest("hex").slice(0, 32);
}

export function contactEmailStatus(): {
  configured: boolean;
  reason: string | null;
  to: string | null;
} {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = process.env.CONTACT_TO_EMAIL || from || null;
  if (!apiKey) return { configured: false, reason: "RESEND_API_KEY ausente", to: null };
  if (!from) return { configured: false, reason: "EMAIL_FROM ausente", to };
  if (!to) return { configured: false, reason: "CONTACT_TO_EMAIL ausente", to: null };
  return { configured: true, reason: null, to };
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

function wrap(title: string, inner: string): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#050608;font-family:Arial,sans-serif;color:#e4e4e7">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050608;padding:28px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#101319;border:1px solid #272b32;border-radius:20px;padding:26px">
<tr><td>
<p style="margin:0 0 18px;font-size:19px;font-weight:800;color:#f4f4f5">Giro<span style="color:#b8f53c">Lucro</span></p>
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.25;color:#fafafa">${title}</h1>
${inner}
<p style="margin:24px 0 0;border-top:1px solid #272b32;padding-top:16px;font-size:11.5px;line-height:1.6;color:#71717a">GiroLucro — seu lucro real na pista. Você recebe este e-mail por causa de um formulário no site.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export async function sendContactNotifications(input: {
  message: ContactInput;
  meta: { path?: string | null; userId?: number | null; ipHash?: string | null };
}): Promise<{ ownerSent: boolean; error: string | null; autoReply: boolean }> {
  const status = contactEmailStatus();
  if (!status.configured) {
    console.warn("[contato] e-mail desabilitado:", status.reason, "| mensagem salva no banco");
    return { ownerSent: false, error: status.reason ?? "não configurado", autoReply: false };
  }

  const { message } = input;
  const safe = {
    name: escapeHtml(message.name),
    email: escapeHtml(message.email),
    phone: escapeHtml(message.phone ?? "—"),
    topic: escapeHtml(topicLabel(message.topic)),
    body: escapeHtml(message.body).replace(/\n/g, "<br />"),
    path: escapeHtml(input.meta.path ?? "/"),
  };
  const from = process.env.EMAIL_FROM!;
  const resend = new Resend(process.env.RESEND_API_KEY!);

  let ownerSent = false;
  let error: string | null = null;
  try {
    const result = await resend.emails.send({
      from,
      to: [status.to!],
      replyTo: message.replyToEmail ? message.email : undefined,
      subject: `Contato: ${topicLabel(message.topic)} — ${message.name}`,
      html: wrap(
        "Nova mensagem de contato",
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px">
          <tr><td style="padding:6px 0;color:#71717a;width:96px">Nome</td><td style="color:#f4f4f5;font-weight:700">${safe.name}</td></tr>
          <tr><td style="padding:6px 0;color:#71717a">E-mail</td><td><a href="mailto:${safe.email}" style="color:#b8f53c">${safe.email}</a></td></tr>
          <tr><td style="padding:6px 0;color:#71717a">Celular</td><td style="color:#f4f4f5">${safe.phone}</td></tr>
          <tr><td style="padding:6px 0;color:#71717a">Assunto</td><td style="color:#f4f4f5">${safe.topic}</td></tr>
          <tr><td style="padding:6px 0;color:#71717a">Vindo de</td><td style="color:#a1a1aa">${safe.path}</td></tr>
        </table>
        <div style="margin-top:16px;background:#0b0d11;border:1px solid #272b32;border-radius:14px;padding:16px;font-size:14px;line-height:1.65;color:#e4e4e7">${safe.body}</div>`,
      ),
      text: [
        `Nome: ${message.name}`,
        `E-mail: ${message.email}`,
        `Celular: ${message.phone ?? "—"}`,
        `Assunto: ${topicLabel(message.topic)}`,
        `Página: ${input.meta.path ?? "/"}`,
        "",
        message.body,
      ].join("\n"),
    });
    if (result.error) {
      error = result.error.message;
      console.error("[contato] Resend recusou:", result.error.message, "| para", maskEmail(message.email));
    } else {
      ownerSent = true;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.error("[contato] falha de rede no Resend:", error);
  }

  // confirmação para quem escreveu (só se a pessoa pediu resposta)
  let autoReply = false;
  if (ownerSent && message.replyToEmail) {
    try {
      const ack = await resend.emails.send({
        from,
        to: [message.email],
        subject: "Recebemos sua mensagem — GiroLucro",
        html: wrap(
          `Falamos com você em instantes, ${safe.name.split(" ")[0] || "patrão"}`,
          `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#a1a1aa">Sua mensagem sobre <b style="color:#f4f4f5">${safe.topic}</b> chegou. A gente responde por aqui mesmo, normalmente no próximo dia útil.</p>
           <div style="margin-top:6px;background:#0b0d11;border:1px solid #272b32;border-radius:14px;padding:14px;font-size:13px;line-height:1.6;color:#a1a1aa">${safe.body.slice(0, 700)}</div>`,
        ),
        text: `Recebemos sua mensagem e respondemos em breve. Obrigado!`,
      });
      autoReply = !ack.error;
    } catch (e) {
      console.error("[contato] confirmação automática falhou:", e instanceof Error ? e.message : e);
    }
  }

  return { ownerSent, error, autoReply };
}
