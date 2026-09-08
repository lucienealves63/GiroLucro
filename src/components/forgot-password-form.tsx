"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Logo } from "@/components/brand";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    start(async () => {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      setPreviewUrl(typeof data.previewUrl === "string" ? data.previewUrl : null);
      setSent(true);
    });
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-10 pt-10">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 90, damping: 18 }}
      >
        <Logo size={40} />
      </motion.div>

      <AnimatePresence mode="wait">
        {!sent ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-9"
          >
            <h1 className="font-display text-[31px] font-bold leading-[1.08] tracking-tight text-zinc-50">
              Vamos colocar você
              <br />
              <span className="text-volt-400">de volta na pista.</span>
            </h1>
            <p className="mt-3 max-w-[330px] text-[13.5px] leading-relaxed text-zinc-400">
              Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um
              link seguro para criar uma nova senha.
            </p>

            <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
              <label className="flex items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.03] px-4 py-3.5 focus-within:border-volt-400/40">
                <Mail className="h-[18px] w-[18px] shrink-0 text-zinc-500" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Seu e-mail cadastrado"
                  autoComplete="email"
                  className="w-full bg-transparent text-[14.5px] font-medium text-zinc-100 placeholder:text-zinc-600"
                />
              </label>
              <button
                type="submit"
                disabled={pending}
                className="pressable mt-2 flex items-center justify-center gap-2 rounded-2xl bg-volt-400 py-4 font-display text-[15.5px] font-bold text-ink-950 disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowRight className="h-5 w-5" strokeWidth={2.6} />
                )}
                {pending ? "Enviando..." : "Enviar link de recuperação"}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-12 text-center"
          >
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-volt-400/25 bg-volt-400/10 text-volt-400">
              <CheckCircle2 className="h-10 w-10" strokeWidth={1.8} />
            </span>
            <h1 className="mt-6 font-display text-[27px] font-bold tracking-tight text-zinc-50">
              Confira seu e-mail
            </h1>
            <p className="mx-auto mt-3 max-w-[330px] text-[13.5px] leading-relaxed text-zinc-400">
              Se existir uma conta vinculada a <span className="font-semibold text-zinc-200">{email}</span>,
              você receberá as instruções. O link vale por 30 minutos.
            </p>
            <p className="mx-auto mt-3 max-w-[320px] text-[11.5px] leading-relaxed text-zinc-600">
              Não encontrou? Espere um minuto e confira Spam, Lixo eletrônico e a aba
              Promoções.
            </p>
            {previewUrl && (
              <a
                href={previewUrl}
                className="pressable mt-5 block rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-[12px] font-bold text-amber-300"
              >
                Abrir link de desenvolvimento
              </a>
            )}
            <button
              onClick={() => setSent(false)}
              className="pressable mt-5 text-[12.5px] font-bold text-volt-400"
            >
              Enviar novamente
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Link
        href="/entrar"
        className="pressable mt-auto flex items-center justify-center gap-2 pt-10 text-[13px] font-bold text-zinc-400"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para entrar
      </Link>
    </div>
  );
}
