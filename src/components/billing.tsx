"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Check,
  Copy,
  Crown,
  Loader2,
  QrCode,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import type { Plan } from "@/lib/billing";
import { DEFAULT_PLAN } from "@/lib/billing";
import { brl } from "@/lib/format";
import { Logo } from "@/components/brand";
import { Toast, useToast } from "@/components/ui";

type PixResponse = {
  ok?: boolean;
  reused?: boolean;
  paymentId?: string;
  status?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  expiresAt?: string;
  error?: string;
};

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
  const plan = plans[0] ?? DEFAULT_PLAN;
  const { msg, show } = useToast();
  const showRef = useRef(show);
  useEffect(() => {
    showRef.current = show;
  }, [show]);

  const [pix, setPix] = useState<PixResponse | null>(null);
  const [pixPending, setPixPending] = useState(false);
  const [pixRemaining, setPixRemaining] = useState(0);
  const [checkingPix, setCheckingPix] = useState(false);

  const activate = () => {
    start(async () => {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycle: plan.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (res.ok && data.ok) {
        show("Acesso Pro liberado");
        router.push("/");
        router.refresh();
      } else {
        show(data.error ?? "Não foi possível abrir o checkout");
      }
    });
  };

  const activatePix = () => {
    setPixPending(true);
    setPix(null);
    void (async () => {
      try {
        const res = await fetch("/api/billing/checkout-pix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cycle: plan.id }),
        });
        const data = (await res.json()) as PixResponse;
        if (res.ok && data.ok && (data.qrCode || data.qrCodeBase64) && data.expiresAt) {
          setPix(data);
        } else {
          show(data.error ?? "Não foi possível gerar o Pix. Tente novamente.");
        }
      } catch {
        show("Não foi possível gerar o Pix. Tente novamente.");
      } finally {
        setPixPending(false);
      }
    })();
  };

  const copyQrCode = async () => {
    const code = pix?.qrCode;
    if (!code) return;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(code);
        show("Código copiado");
        return;
      } catch {
        // tenta o fallback abaixo
      }
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      show("Código copiado");
    } catch {
      show("Copie manualmente o código abaixo.");
    }
  };

  const checkPix = async () => {
    setCheckingPix(true);
    try {
      const res = await fetch("/api/billing/status");
      const data = (await res.json().catch(() => ({}))) as { planStatus?: string };
      if (res.ok && data.planStatus === "active") {
        setPix(null);
        router.push("/");
        router.refresh();
        return;
      }
      show("Ainda não confirmamos o pagamento. Você pode verificar de novo.");
    } catch {
      show("Não foi possível verificar agora. Tente novamente.");
    } finally {
      setCheckingPix(false);
    }
  };

  const cancelPix = () => {
    setPix(null);
    setPixRemaining(0);
  };

  // Polling do status: ao confirmar, volta para o app.
  useEffect(() => {
    if (!pix) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/billing/status");
        const data = (await res.json().catch(() => ({}))) as { planStatus?: string };
        if (res.ok && data.planStatus === "active") {
          setPix(null);
          router.push("/");
          router.refresh();
        }
      } catch {
        // rede momentânea: o próximo tick tenta de novo
      }
    }, 8_000);
    return () => clearInterval(timer);
  }, [pix, router]);

  // Regressivo do QR Code.
  useEffect(() => {
    const expiresAt = pix?.expiresAt;
    if (!expiresAt) return;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setPix(null);
        setPixRemaining(0);
        showRef.current("O QR Code expirou. Gere um novo Pix para continuar.");
      } else {
        setPixRemaining(Math.ceil(ms / 1000));
      }
    };
    tick();
    const timer = setInterval(tick, 1_000);
    return () => clearInterval(timer);
  }, [pix?.expiresAt]);

  const pixMinutes = Math.floor(pixRemaining / 60);
  const pixSeconds = pixRemaining % 60;
  const pixCountdown = `${String(pixMinutes).padStart(2, "0")}:${String(pixSeconds).padStart(2, "0")}`;

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
              Acesso total liberado
              {periodEnd ? (
                <>
                  {" "}
                  · válido até <span className="font-semibold text-volt-300">{periodEnd}</span>
                </>
              ) : null}
              {cycle ? " · pagamento único." : "."}
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
              Pague uma vez e libere o Pro para sempre — sem mensalidade e sem renovação.
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
              Acesso encerrado, {firstName}.
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">
              {periodEnd
                ? `Seu acesso já pago continua até ${periodEnd}. Você pode reativar quando quiser.`
                : "Faça o pagamento único para voltar a usar os recursos Pro."}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight text-zinc-50">
              Seu teste acabou, {firstName}.
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-zinc-400">
              Para continuar registrando giros e acompanhando seu lucro real, libere o Pro
              com um pagamento único — custa menos que um litro de gasolina.
            </p>
          </>
        )}
      </motion.div>

      {/* plano único */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, type: "spring", stiffness: 90, damping: 18 }}
        className="relative mt-6 overflow-hidden rounded-3xl border border-volt-400/50 bg-volt-400/[0.07] p-5 text-left"
      >
        <span className="absolute right-4 top-4 rounded-full bg-volt-400 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wider text-ink-950">
          Pagamento único
        </span>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
          GiroLucro Pro
        </p>
        <p className="mt-1.5 flex items-baseline gap-1.5">
          <span className="tabular font-display text-[36px] font-bold leading-none text-zinc-50">
            {brl(plan.price)}
          </span>
          <span className="text-[13px] font-semibold text-zinc-500">uma vez</span>
        </p>
        <p className="mt-1.5 text-[12px] font-medium text-volt-300">{plan.tagline}</p>
        <span className="absolute bottom-5 right-5 flex h-6 w-6 items-center justify-center rounded-full border border-volt-400 bg-volt-400">
          <Check className="h-4 w-4 text-ink-950" strokeWidth={3} />
        </span>
      </motion.div>

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
        <>
          <button
            onClick={activate}
            disabled={pending || pixPending}
            className="pressable mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-volt-400 py-4 font-display text-[15.5px] font-bold text-ink-950 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Crown className="h-5 w-5" strokeWidth={2.4} />}
            {pending
              ? "Abrindo checkout..."
              : status === "pending"
                ? "Continuar pagamento"
                : status === "canceled"
                  ? `Reativar Pro · ${brl(plan.price)}`
                  : `Liberar Pro · ${brl(plan.price)}`}
          </button>

          {!pix && (
            <button
              onClick={activatePix}
              disabled={pixPending || pending}
              className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-volt-400/35 bg-volt-400/[0.07] py-4 font-display text-[15.5px] font-bold text-volt-300 disabled:opacity-50"
            >
              {pixPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="h-5 w-5" strokeWidth={2.4} />}
              {pixPending ? "Gerando Pix..." : `Pagar com Pix · ${brl(plan.price)}`}
            </button>
          )}
        </>
      )}

      {pix && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-3xl border border-volt-400/30 bg-white/[0.025] p-5"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
              <QrCode className="h-4 w-4 text-volt-400" /> Pague com Pix
            </p>
            <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold tabular text-volt-300">
              <Timer className="h-3.5 w-3.5" /> {pixCountdown}
            </span>
          </div>

          <div className="mx-auto aspect-square w-full max-w-[230px] overflow-hidden rounded-2xl border border-white/10 bg-white p-2">
            {pix.qrCodeBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${pix.qrCodeBase64}`}
                alt="QR Code do Pix"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                <QrCode className="h-10 w-10 text-ink-900" />
                <p className="text-[11px] font-semibold text-ink-900">
                  Use a opção copiar código para colar no app do banco.
                </p>
              </div>
            )}
          </div>

          <p className="mt-3 text-center text-[12px] text-zinc-400">
            Escaneie o QR Code no app do seu banco e confirme o pagamento.{" "}
            <span className="font-semibold text-zinc-200">Pagamento único de {brl(plan.price)}</span>
            , sem renovação automática.
          </p>

          {pix.qrCode && (
            <button
              onClick={copyQrCode}
              className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.04] py-3 text-[13px] font-bold text-zinc-300"
            >
              <Copy className="h-4 w-4" /> Copiar código Pix
            </button>
          )}

          <div className="mt-3 flex flex-col gap-2.5">
            <button
              onClick={checkPix}
              disabled={checkingPix}
              className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-volt-400 py-3 font-display text-[14px] font-bold text-ink-950 disabled:opacity-50"
            >
              {checkingPix ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.6} />}
              {checkingPix ? "Verificando..." : "Já paguei, verificar"}
            </button>
            <button
              onClick={cancelPix}
              disabled={checkingPix}
              className="pressable mx-auto text-[12px] font-semibold text-zinc-500 underline-offset-4 hover:underline disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </motion.div>
      )}

      {status === "active" && (
        <div className="mt-5 flex flex-col gap-3">
          <Link
            href="/"
            className="pressable flex w-full items-center justify-center rounded-2xl bg-volt-400 py-4 font-display text-[15.5px] font-bold text-ink-950"
          >
            Voltar ao app
          </Link>
        </div>
      )}

      <p className="mt-4 flex items-start justify-center gap-1.5 text-center text-[10.5px] leading-relaxed text-zinc-600">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Pagamento seguro via Mercado Pago. Valor único de {brl(plan.price)} — sem
        mensalidade e sem renovação automática.
      </p>

      <Toast msg={msg} />
    </div>
  );
}
