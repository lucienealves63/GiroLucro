"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CircleAlert, Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/brand";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use pelo menos 8 caracteres na nova senha.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As duas senhas precisam ser iguais.");
      return;
    }

    start(async () => {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        router.push("/entrar?redefinida=1");
        router.refresh();
      } else {
        setError(data.error ?? "Não foi possível atualizar a senha.");
      }
    });
  };

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-10 pt-10">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <Logo size={40} />
        <h1 className="mt-9 font-display text-[31px] font-bold leading-[1.08] tracking-tight text-zinc-50">
          Crie uma senha
          <br />
          <span className="text-volt-400">nova e segura.</span>
        </h1>
        <p className="mt-3 max-w-[330px] text-[13.5px] leading-relaxed text-zinc-400">
          Ela deve ter pelo menos 8 caracteres. Depois da troca, todos os dispositivos
          conectados à sua conta serão desconectados.
        </p>
      </motion.div>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="mt-8 flex flex-col gap-3"
      >
        <label className="flex items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.03] px-4 py-3.5 focus-within:border-volt-400/40">
          <LockKeyhole className="h-[18px] w-[18px] shrink-0 text-zinc-500" />
          <input
            type={showPassword ? "text" : "password"}
            required
            autoFocus
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nova senha (mín. 8 caracteres)"
            autoComplete="new-password"
            className="w-full bg-transparent text-[14.5px] font-medium text-zinc-100 placeholder:text-zinc-600"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="pressable p-1 text-zinc-500"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-white/[0.09] bg-white/[0.03] px-4 py-3.5 focus-within:border-volt-400/40">
          <LockKeyhole className="h-[18px] w-[18px] shrink-0 text-zinc-500" />
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            maxLength={72}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
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
              <CircleAlert className="h-4 w-4 shrink-0" /> {error}
            </motion.p>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={pending}
          className="pressable mt-2 flex items-center justify-center gap-2 rounded-2xl bg-volt-400 py-4 font-display text-[15.5px] font-bold text-ink-950 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LockKeyhole className="h-5 w-5" />}
          {pending ? "Atualizando..." : "Salvar nova senha"}
        </button>
      </motion.form>

      <Link
        href="/entrar"
        className="pressable mt-auto flex items-center justify-center gap-2 pt-10 text-[13px] font-bold text-zinc-400"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para entrar
      </Link>
    </div>
  );
}
