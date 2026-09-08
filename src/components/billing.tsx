"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Check,
  Crown,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import type { Plan } from "@/lib/billing";
import { brl } from "@/lib/format";
import { Logo } from "@/components/brand";
import { Toast, useToast } from "@/components/ui";

export function BillingClient({
  plans,
  features,
  status,
  trialDaysLeft,
  periodEnd,
  cycle,
  firstName,
}: {
  plans: Plan[];
  features: string[];
  status: "active" | "trialing" | "pending" | "expired" | "canceled";
  trialDaysLeft: number | null;
  periodEnd: string | null;
  cycle: string | null;
  firstName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string>("yearly");
  const { msg, show } = useToast();

  const activate = () => {
    start(async () => {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (res.ok && data.ok) {
        show("Plano de demonstração ativado");
        router.push("/");
        router.refresh();
      } else {
        show(data.error ?? "Não foi possível abrir o checkout");
      }
    });
  };

  const cancel = () => {
    if (!window.confirm("Cancelar a renovação automática? Você mantém o acesso até o fim do período.")) return;
    start(async () => {
      const response = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      show(response.ok ? "Renovação cancelada" : (data.error ?? "Falha ao cancelar"));
      if (response.ok) router.refresh();
    });
  };

  return (
    <div className="px-5 pb-10">
      <header className="flex items-center justify-between pb-6 pt-6">
        <Logo />
        {status === "active" && (
          <span className="flex items-center gap-1.5 rounded-full border border-volt-400/30 bg-volt-400/10 px-3 py-1.5 text-[10.5px] font-bold text-volt-300">
            <Crown className="h-3.5 w-3.5" /> PRO
          </span>
        )}
      </header>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 90, damping: 18 }}
      >
        {status === "active" ? (
          <>
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-zinc-50">
              Você é Pro, {firstName}.
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">
              Acesso total liberado até{" "}
              <span className="font-semibold text-volt-300">{periodEnd}</span>
              {cycle === "yearly" ? " (plano anual)" : " (plano mensal)"}.
            </p>
          </>
        ) : status === "trialing" ? (
          <>
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-zinc-50">
              Seu teste grátis vale por{" "}
              <span className="text-volt-400">
                {trialDaysLeft} {trialDaysLeft === 1 ? "dia" : "dias"}
              </span>
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">
              Assine agora e a primeira cobrança será programada para depois do trial.
            </p>
          </>
        ) : status === "pending" ? (
          <>
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-zinc-50">
              Pagamento em confirmação, {firstName}.
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">
              Se você ainda não concluiu, continue no checkout. Depois da aprovação, o
              Mercado Pago libera seu Pro automaticamente.
            </p>
          </>
        ) : status === "canceled" ? (
          <>
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-zinc-50">
              Renovação cancelada, {firstName}.
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">
              {periodEnd
                ? `Seu acesso já pago continua até ${periodEnd}. Você pode reativar quando quiser.`
                : "Escolha um plano para voltar a usar os recursos Pro."}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-zinc-50">
              Seu teste acabou, {firstName}.
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">
              Para continuar registrando giros e acompanhando seu lucro real, escolha
              um plano — custa menos que um litro de gasolina.
            </p>
          </>
        )}
      </motion.div>

      {/* planos */}
      <div className="mt-6 flex flex-col gap-3">
        {plans.map((p, i) => {
          const active = selected === p.id;
          return (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.07, type: "spring", stiffness: 90, damping: 18 }}
              onClick={() => setSelected(p.id)}
              className={clsx(
                "pressable relative overflow-hidden rounded-3xl border p-5 text-left",
                active ? "border-volt-400/50 bg-volt-400/[0.07]" : "border-white/[0.09] bg-white/[0.02]",
              )}
            >
              {p.highlight && (
                <span className="absolute right-4 top-4 rounded-full bg-volt-400 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wider text-ink-950">
                  Mais escolhido
                </span>
              )}
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                Plano {p.label}
              </p>
              <p className="mt-1.5 flex items-baseline gap-1.5">
                <span className="tabular font-display text-[32px] font-bold leading-none text-zinc-50">
                  {brl(p.price)}
                </span>
                <span className="text-[13px] font-semibold text-zinc-500">
                  /{p.id === "monthly" ? "mês" : "ano"}
                </span>
              </p>
              <p className="mt-1.5 text-[12px] font-medium text-volt-300">{p.tagline}</p>
              <span
                className={clsx(
                  "absolute bottom-5 right-5 flex h-6 w-6 items-center justify-center rounded-full border",
                  active ? "border-volt-400 bg-volt-400" : "border-white/[0.15]",
                )}
              >
                {active && <Check className="h-4 w-4 text-ink-950" strokeWidth={3} />}
              </span>
            </motion.button>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mt-4 rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5"
      >
        <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
          <Sparkles className="h-3.5 w-3.5 text-volt-400" /> Tudo incluso no Pro
        </p>
        <ul className="flex flex-col gap-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-[12.5px] leading-snug text-zinc-300">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-volt-400" />
              {f}
            </li>
          ))}
        </ul>
      </motion.div>

      {status !== "active" && (
        <button
          onClick={activate}
          disabled={pending}
          className="pressable mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-volt-400 py-4 font-display text-[15.5px] font-bold text-ink-950 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crown className="h-5 w-5" strokeWidth={2.4} />}
          {pending
            ? "Abrindo checkout..."
            : status === "pending"
              ? "Continuar pagamento"
              : status === "canceled"
                ? `Reativar Pro · ${brl(plans.find((p) => p.id === selected)?.price ?? 0)}`
                : `Assinar GiroLucro Pro · ${brl(plans.find((p) => p.id === selected)?.price ?? 0)}`}
        </button>
      )}

      {status === "active" && (
        <div className="mt-5 flex flex-col gap-3">
          <a
            href="/"
            className="pressable flex w-full items-center justify-center rounded-2xl bg-volt-400 py-4 font-display text-[15.5px] font-bold text-ink-950"
          >
            Voltar ao app
          </a>
          <button
            onClick={cancel}
            disabled={pending}
            className="pressable mx-auto text-[12px] font-semibold text-zinc-500 underline-offset-4 hover:underline disabled:opacity-50"
          >
            Cancelar renovação automática
          </button>
        </div>
      )}

      <p className="mt-4 flex items-start justify-center gap-1.5 text-center text-[10.5px] leading-relaxed text-zinc-600">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Pagamento seguro. Sem fidelidade — cancele quando quiser e mantenha o acesso
        até o fim do período.
      </p>

      <Toast msg={msg} />
    </div>
  );
}
