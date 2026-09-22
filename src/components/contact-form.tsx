"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Loader2,
  Mail,
  MessageSquareText,
  Phone,
  Send,
  User,
} from "lucide-react";
import clsx from "clsx";
import { Logo } from "@/components/brand";
import { CONTACT_TOPICS } from "@/lib/contact-topics";
import { hasAnalyticsConsent } from "@/lib/cookie-consent";

/**
 * Página de contato pública. Grava no banco (aparece em /admin?aba=contato)
 * e tenta mandar cópia por e-mail. Se o e-mail estiver sem configurar, a
 * mensagem continua salva — e avisamos isso com honestidade na tela.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_LEN = 12;

/**
 * Só envia o identificador de visitas quando o visitante autorizou analytics.
 * Sem consentimento, a mensagem continua sendo registrada normalmente — o que
 * não acontece é o vínculo com dados de navegação.
 */
function readVisitorId(): string | null {
  if (typeof document === "undefined") return null;
  if (!hasAnalyticsConsent()) return null;
  const m = /(?:^|;\s*)gl_vid=([^;]*)/.exec(document.cookie);
  const value = m?.[1] ? decodeURIComponent(m[1]) : "";
  return /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : null;
}

export function ContactForm({
  prefill,
  emailConfigured,
  supportEmail,
}: {
  prefill: { name: string; email: string };
  emailConfigured: boolean;
  supportEmail: string | null;
}) {
  const [topic, setTopic] = useState<string>("duvida");
  const [name, setName] = useState(prefill.name);
  const [email, setEmail] = useState(prefill.email);
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState("");
  const [wantsReply, setWantsReply] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: number; note: string | null } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Diga seu nome para a gente saber com quem fala.");
    if (!EMAIL_RE.test(email.trim())) return setError("Confira o e-mail — é por ele que a gente responde.");
    if (body.trim().length < MIN_LEN) return setError("Escreva pelo menos uma frase sobre o assunto.");
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          topic,
          body: body.trim(),
          replyToEmail: wantsReply,
          sourcePath: "/contato",
          visitorId: readVisitorId(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não conseguiu enviar agora. Tente de novo em instantes.");
        return;
      }
      setDone({ id: Number(data.id ?? 0), note: data.note ?? null });
    } catch {
      setError("Sem conexão com o servidor agora. Tente de novo em alguns segundos.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full bg-transparent text-[14.5px] font-medium text-zinc-100 placeholder:text-zinc-600 focus:outline-none";
  const boxClass =
    "flex items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.03] px-4 py-3.5 focus-within:border-volt-400/40";

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-16 pt-8">
      <div className="flex items-center justify-between">
        <Logo size={34} />
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[12px] font-bold text-zinc-500 hover:text-zinc-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
      </div>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="ok"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-10"
          >
            <div className="rounded-[24px] border border-volt-400/25 bg-volt-400/[0.06] p-6 text-center">
              <CheckCircle2 className="mx-auto h-11 w-11 text-volt-400" strokeWidth={1.8} />
              <h1 className="mt-4 font-display text-[24px] font-bold leading-tight text-zinc-50">
                Mensagem enviada.
                <br />
                Valeu por escrever!
              </h1>
              <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-400">
                Registramos seu contato
                {done.id ? ` (protocolo #${done.id})` : ""} e respondemos no e-mail{" "}
                <b className="text-zinc-200">{email}</b> normalmente no próximo dia útil.
              </p>
              {done.note && (
                <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-left text-[12px] leading-relaxed text-amber-200">
                  {done.note}
                </p>
              )}
              <Link
                href="/"
                className="pressable mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-volt-400 px-5 py-3.5 text-[14px] font-bold text-ink-950"
              >
                Voltar ao app <ArrowLeft className="h-4 w-4 rotate-180" />
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={submit}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
            className="mt-8"
          >
            <h1 className="font-display text-[30px] font-bold leading-[1.08] tracking-tight text-zinc-50">
              Fala com a
              <br />
              <span className="text-volt-400">gente da pista.</span>
            </h1>
            <p className="mt-3 max-w-[330px] text-[13.5px] leading-relaxed text-zinc-400">
              Dúvida, bug, pagamento ou ideia de função: cai direto na caixa de entrada do time do
              GiroLucro. Resposta em até 1 dia útil.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {CONTACT_TOPICS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTopic(t.id)}
                  className={clsx(
                    "pressable rounded-full border px-3.5 py-2 text-[12px] font-semibold transition",
                    topic === t.id
                      ? "border-volt-400/50 bg-volt-400/15 text-volt-300"
                      : "border-white/[0.08] bg-white/[0.03] text-zinc-400",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-zinc-600">
              {CONTACT_TOPICS.find((t) => t.id === topic)?.hint ?? "escolha o assunto que combina mais"}
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <label className={boxClass}>
                <User className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden="true" />
                <span className="sr-only">Seu nome</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  autoComplete="name"
                  maxLength={60}
                  className={inputClass}
                />
              </label>
              <label className={boxClass}>
                <Mail className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden="true" />
                <span className="sr-only">Seu e-mail</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Seu e-mail"
                  autoComplete="email"
                  className={inputClass}
                />
              </label>
              <label className={boxClass}>
                <Phone className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden="true" />
                <span className="sr-only">Celular ou WhatsApp (opcional)</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Celular/WhatsApp (opcional)"
                  autoComplete="tel"
                  maxLength={24}
                  className={inputClass}
                />
              </label>

              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.03] px-4 py-3.5 focus-within:border-volt-400/40">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-[18px] w-[18px] shrink-0 text-zinc-500" aria-hidden="true" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    Mensagem
                  </span>
                  <span
                    className={clsx(
                      "ml-auto text-[11px] font-bold tabular",
                      body.length > 3800 ? "text-rose-450" : "text-zinc-600",
                    )}
                  >
                    <span aria-hidden="true">{body.length}/4000</span>
                    <span className="sr-only">{body.length} de 4000 caracteres</span>
                  </span>
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, 4000))}
                  rows={6}
                  placeholder="Conte o que aconteceu. Print não dá pra colar aqui, então descreva a tela e o que você esperava ver."
                  className="mt-2.5 w-full resize-y bg-transparent text-[14px] leading-relaxed font-medium text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => setWantsReply((v) => !v)}
                className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left"
              >
                <span
                  className={clsx(
                    "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border",
                    wantsReply ? "border-volt-400 bg-volt-400" : "border-white/20",
                  )}
                >
                  {wantsReply && <CheckCircle2 className="h-3.5 w-3.5 text-ink-950" strokeWidth={2.6} />}
                </span>
                <span className="text-[12.5px] leading-snug text-zinc-400">
                  Quero resposta por e-mail
                  <span className="block text-[11.5px] text-zinc-600">
                    desmarcado, a mensagem vai só para o painel do time
                  </span>
                </span>
              </button>

              {/* honeypot anti-robô: invisível para gente, preenchido por script */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
              />

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 rounded-xl border border-rose-450/30 bg-rose-450/[0.07] px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-200"
                  >
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <p className="text-[11.5px] leading-relaxed text-zinc-400">
                Ao enviar esta mensagem, seus dados serão usados para responder ao seu contato
                conforme nossa{" "}
                <Link
                  href="/privacidade"
                  className="font-semibold text-volt-300 underline underline-offset-4"
                >
                  Política de Privacidade
                </Link>
                .
              </p>

              <button
                type="submit"
                disabled={busy}
                className="pressable mt-1 flex items-center justify-center gap-2 rounded-2xl bg-volt-400 px-5 py-4 text-[14.5px] font-bold text-ink-950 shadow-[0_0_30px_rgba(184,245,60,0.22)] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? "Enviando..." : "Enviar mensagem"}
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-4 text-[12.5px] text-zinc-500">
              <p className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 shrink-0 text-zinc-600" />
                Resposta em até 1 dia útil (a gente também é motorista).
              </p>
              {supportEmail && (
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-zinc-600" />
                  Prefere direto?{" "}
                  <a href={`mailto:${supportEmail}`} className="font-semibold text-volt-400">
                    {supportEmail}
                  </a>
                </p>
              )}
              {!emailConfigured && (
                <p className="text-[11.5px] leading-relaxed text-zinc-600">
                  A cópia por e-mail do time está desativada neste ambiente — sua mensagem continua
                  salva e visível no painel administrativo.
                </p>
              )}
              <p className="text-[11.5px] leading-relaxed text-zinc-600">
                Não enviamos propaganda e não vendemos seus dados. Para excluir o que você escreveu
                por aqui, é só pedir na própria conversa.
              </p>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
