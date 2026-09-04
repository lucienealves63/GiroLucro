"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CircleAlert, Loader2, Lock, Mail, User } from "lucide-react";
import { Logo } from "@/components/brand";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await fetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError(data.error ?? "Algo deu errado. Tente de novo.");
      }
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

        <h1 className="mt-9 font-display text-[31px] font-bold leading-[1.08] tracking-tight text-zinc-50">
          {isRegister ? (
            <>
              Pare de trabalhar
              <br />
              <span className="text-volt-400">no escuro.</span>
            </>
          ) : (
            <>
              De volta à pista,
              <br />
              <span className="text-volt-400">patrão.</span>
            </>
          )}
        </h1>
        <p className="mt-3 max-w-[300px] text-[13.5px] leading-relaxed text-zinc-400">
          {isRegister
            ? "Lucro real, comparativo de apps, metas e oficina — tudo no seu bolso. 7 dias grátis, sem pedir cartão."
            : "Seus números, metas e repasses estão te esperando onde você parou."}
        </p>
      </motion.div>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 90, damping: 18, delay: 0.08 }}
        className="mt-8 flex flex-col gap-3"
      >
        {isRegister && (
          <label className="flex items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.03] px-4 py-3.5 focus-within:border-volt-400/40">
            <User className="h-[18px] w-[18px] shrink-0 text-zinc-500" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como te chamam na pista?"
              autoComplete="name"
              maxLength={60}
              className="w-full bg-transparent text-[14.5px] font-medium text-zinc-100 placeholder:text-zinc-600"
            />
          </label>
        )}
        <label className="flex items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.03] px-4 py-3.5 focus-within:border-volt-400/40">
          <Mail className="h-[18px] w-[18px] shrink-0 text-zinc-500" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Seu e-mail"
            autoComplete="email"
            className="w-full bg-transparent text-[14.5px] font-medium text-zinc-100 placeholder:text-zinc-600"
          />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.03] px-4 py-3.5 focus-within:border-volt-400/40">
          <Lock className="h-[18px] w-[18px] shrink-0 text-zinc-500" />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isRegister ? "Crie uma senha (mín. 6)" : "Sua senha"}
            autoComplete={isRegister ? "new-password" : "current-password"}
            className="w-full bg-transparent text-[14.5px] font-medium text-zinc-100 placeholder:text-zinc-600"
          />
        </label>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 overflow-hidden rounded-xl border border-rose-400/25 bg-rose-400/[0.07] px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-300"
            >
              <CircleAlert className="h-4 w-4 shrink-0" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>

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
          {pending ? "Um momento..." : isRegister ? "Criar minha conta grátis" : "Entrar"}
        </button>
      </motion.form>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-auto pt-8 text-center"
      >
        {isRegister ? (
          <p className="text-[13px] text-zinc-500">
            Já tem conta?{" "}
            <Link href="/entrar" className="font-bold text-volt-400">
              Entrar
            </Link>
          </p>
        ) : (
          <p className="text-[13px] text-zinc-500">
            Ainda não tem conta?{" "}
            <Link href="/criar-conta" className="font-bold text-volt-400">
              Criar grátis
            </Link>
          </p>
        )}
        <p className="mt-4 text-[10.5px] leading-relaxed text-zinc-600">
          Ao continuar você concorda com os termos de uso. Seus dados são só seus —
          nada é compartilhado com as plataformas.
        </p>
      </motion.div>
    </div>
  );
}
