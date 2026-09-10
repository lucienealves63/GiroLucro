"use client";

import { AnimatePresence, motion, useSpring, useTransform } from "framer-motion";
import clsx from "clsx";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

/* ---------------------------------- Card ---------------------------------- */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "card-hover rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.045] to-white/[0.015] p-5 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
        {children}
      </h2>
      {right}
    </div>
  );
}

/* ---------------------------- Número animado ------------------------------- */

export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const spring = useSpring(0, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => format(v));
  const [text, setText] = useState(format(0));
  const first = useRef(true);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    const unsub = display.on("change", (v) => setText(v));
    if (first.current) {
      first.current = false;
      setText(display.get());
    }
    return unsub;
  }, [display]);

  return <span className={clsx("tabular", className)}>{text}</span>;
}

/* ------------------------------ Anel de meta ------------------------------- */

export function GoalRing({
  pct,
  size = 132,
  stroke = 10,
  children,
}: {
  pct: number; // 0..1+
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(1, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const over = pct >= 1;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "#b8f53c" : "#b8f53c"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped) }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }}
          style={
            over
              ? { filter: "drop-shadow(0 0 10px rgba(184,245,60,0.6))" }
              : undefined
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------- Barra fina -------------------------------- */

export function ThinBar({
  pct,
  colorClass = "bg-volt-400",
  className,
  delay = 0,
}: {
  pct: number;
  colorClass?: string;
  className?: string;
  delay?: number;
}) {
  return (
    <div className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]", className)}>
      <motion.div
        className={clsx("h-full rounded-full", colorClass)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }}
        transition={{ type: "spring", stiffness: 80, damping: 20, delay }}
      />
    </div>
  );
}

/* --------------------------------- Chips ----------------------------------- */

export function Chip({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "pressable rounded-full border px-3.5 py-1.5 text-[12px] font-semibold",
        active
          ? "border-volt-400/50 bg-volt-400/15 text-volt-300"
          : "border-white/[0.08] bg-white/[0.03] text-zinc-400",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* --------------------------------- Toast ----------------------------------- */

export function Toast({ msg }: { msg: string | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="fixed inset-x-0 bottom-24 z-[60] mx-auto flex w-fit max-w-[90%] items-center gap-2 rounded-2xl border border-volt-400/30 bg-[color:var(--gl-toast-bg)]/95 px-4 py-2.5 text-[13px] font-semibold text-volt-200 shadow-[0_16px_44px_-10px_rgba(184,245,60,0.35)] backdrop-blur-xl"
        >
          <CheckCircle2 className="h-4 w-4 text-volt-400" />
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  };
  return { msg, show };
}

/* ---------------------------- Entrada animada ------------------------------ */

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 18, delay }}
    >
      {children}
    </motion.div>
  );
}

/* --------------------------- Input de valor grande -------------------------- */

export function MoneyInput({
  value,
  onChange,
  placeholder = "0,00",
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-center gap-1.5">
      <span className="font-display text-2xl font-semibold text-zinc-500">R$</span>
      <input
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        placeholder={placeholder}
        className="tabular w-44 bg-transparent text-center font-display text-[44px] font-bold leading-none text-zinc-50 placeholder:text-zinc-700"
      />
    </div>
  );
}

export function Field({
  label,
  suffix,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 focus-within:border-volt-400/40">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,-]/g, ""))}
          placeholder={placeholder}
          className="tabular w-full bg-transparent font-display text-lg font-semibold text-zinc-100 placeholder:text-zinc-700"
        />
        {suffix && (
          <span className="shrink-0 text-[12px] font-semibold text-zinc-500">{suffix}</span>
        )}
      </div>
    </label>
  );
}
