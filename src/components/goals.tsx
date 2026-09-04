"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  CalendarCheck2,
  Check,
  Minus,
  Palmtree,
  PiggyBank,
  Plus,
  Umbrella,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { brl, parseBR } from "@/lib/format";
import {
  AnimatedNumber,
  Card,
  GoalRing,
  Field,
  Reveal,
  SectionTitle,
  ThinBar,
  Toast,
  useToast,
} from "@/components/ui";

export interface DayMark {
  day: number;
  status: "hit" | "miss" | "idle" | "future";
}

export function GoalsClient({
  settings,
  dailyGoal,
  daysPerMonth,
  monthNet,
  hitDays,
  workedDays,
  calendar,
  reserveAccum,
  avgDailyNet,
  paidDaysOff,
  vacationTarget,
  hasData,
}: {
  settings: { monthlyGoal: number; workDaysPerWeek: number; reservePercent: number };
  dailyGoal: number;
  daysPerMonth: number;
  monthNet: number;
  hitDays: number;
  workedDays: number;
  calendar: DayMark[];
  reserveAccum: number;
  avgDailyNet: number;
  paidDaysOff: number;
  vacationTarget: number;
  hasData: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { msg, show } = useToast();

  const [goal, setGoal] = useState(String(settings.monthlyGoal).replace(".", ","));
  const [days, setDays] = useState(settings.workDaysPerWeek);
  const [reserve, setReserve] = useState(settings.reservePercent);

  const goalNum = parseBR(goal) || settings.monthlyGoal;
  const previewDaily = goalNum / Math.max(1, Math.round(days * 4.345));
  const monthPct = settings.monthlyGoal > 0 ? monthNet / settings.monthlyGoal : 0;

  const dirty =
    goalNum !== settings.monthlyGoal ||
    days !== settings.workDaysPerWeek ||
    reserve !== settings.reservePercent;

  const save = () => {
    start(async () => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyGoal: goalNum,
          workDaysPerWeek: days,
          reservePercent: reserve,
        }),
      });
      if (res.ok) {
        show("Metas atualizadas");
        router.refresh();
      }
    });
  };

  return (
    <div className="px-5 pb-10">
      <header className="pb-5 pt-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-zinc-50">
          Metas & Reserva
        </h1>
        <p className="mt-1 text-[12.5px] text-zinc-500">
          Transforme o mês em metas diárias possíveis
        </p>
      </header>

      {!hasData ? (
        <Card className="py-12 text-center">
          <p className="text-[14px] font-medium text-zinc-400">Defina suas metas agora.</p>
          <p className="mt-1.5 text-[12.5px] text-zinc-500">
            Com os primeiros giros registrados, o acompanhamento aparece aqui.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {/* progresso do mês */}
          <Reveal>
            <Card className="flex items-center gap-5">
              <GoalRing pct={monthPct} size={124} stroke={11}>
                <span className="font-display text-[20px] font-bold text-zinc-50">
                  {Math.min(999, Math.round(monthPct * 100))}%
                </span>
                <span className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                  do mês
                </span>
              </GoalRing>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Lucro líquido no mês
                </p>
                <p className={clsx("mt-1 font-display text-[24px] font-bold leading-none", monthNet >= 0 ? "text-volt-300" : "text-rose-400")}>
                  <AnimatedNumber value={monthNet} format={(v) => brl(v)} />
                </p>
                <p className="mt-1.5 text-[12px] text-zinc-500">
                  meta {brl(settings.monthlyGoal)} · {brl(dailyGoal)}/dia
                </p>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <CalendarCheck2 className="h-3.5 w-3.5 text-volt-400" />
                  <p className="text-[11.5px] font-semibold text-zinc-300">
                    {hitDays} de {workedDays} dias na meta
                  </p>
                </div>
              </div>
            </Card>
          </Reveal>

          {/* calendário do mês */}
          <Reveal delay={0.05}>
            <div>
              <SectionTitle>Ritmo do mês</SectionTitle>
              <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="grid grid-cols-7 gap-y-2.5">
                  {calendar.map((d) => (
                    <div key={d.day} className="flex flex-col items-center gap-1">
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.15 + d.day * 0.008, type: "spring", stiffness: 300, damping: 20 }}
                        className={clsx(
                          "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                          d.status === "hit" && "bg-volt-400 text-ink-950",
                          d.status === "miss" && "bg-amber-400/25 text-amber-300",
                          d.status === "idle" && "bg-white/[0.06] text-zinc-600",
                          d.status === "future" && "border border-dashed border-white/[0.08] text-transparent",
                        )}
                      >
                        {d.day}
                      </motion.span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-center gap-4 text-[10px] font-semibold text-zinc-500">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-volt-400" /> meta batida</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400/60" /> abaixo</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/10" /> folga</span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* reserva */}
          <Reveal delay={0.1}>
            <Card>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-volt-400/10 text-volt-400">
                  <PiggyBank className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-display text-[15.5px] font-bold text-zinc-100">
                    Fundo dos dias fracos
                  </p>
                  <p className="text-[11.5px] text-zinc-500">
                    {reserve}% guardado de cada dia lucrativo
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                    Reserva (30d)
                  </p>
                  <p className="tabular mt-1 font-display text-[19px] font-bold text-volt-300">
                    {brl(reserveAccum)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                    Folgas pagas
                  </p>
                  <p className="tabular mt-1 font-display text-[19px] font-bold text-zinc-100">
                    {paidDaysOff.toFixed(1).replace(".", ",")}{" "}
                    <span className="text-[12px] font-semibold text-zinc-500">dias</span>
                  </p>
                </div>
              </div>
              <div className="mt-3.5">
                <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                  Quanto guardar por dia bom
                </p>
                <div className="flex gap-2">
                  {[5, 10, 15, 20].map((v) => (
                    <button
                      key={v}
                      onClick={() => setReserve(v)}
                      className={clsx(
                        "pressable flex-1 rounded-xl border py-2.5 text-[12.5px] font-bold",
                        reserve === v
                          ? "border-volt-400/50 bg-volt-400/15 text-volt-300"
                          : "border-white/[0.08] bg-white/[0.03] text-zinc-500",
                      )}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </Reveal>

          {/* férias */}
          {vacationTarget > 0 && (
            <Reveal delay={0.14}>
              <Card>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                    <Palmtree className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-display text-[15.5px] font-bold text-zinc-100">
                      Férias sem aperto
                    </p>
                    <p className="text-[11.5px] text-zinc-500">
                      sua média: {brl(avgDailyNet)} líquido/dia
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[12.5px] text-zinc-400">
                      7 dias parado = <span className="font-bold text-zinc-100">{brl(vacationTarget)}</span>
                    </p>
                    <p className="tabular text-[11.5px] font-bold text-sky-300">
                      {Math.min(100, (reserveAccum / vacationTarget) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <ThinBar
                    className="mt-2"
                    pct={reserveAccum / vacationTarget}
                    colorClass="bg-sky-400"
                  />
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-500">
                    <Umbrella className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Sua reserva atual cobriria{" "}
                    {Math.floor(paidDaysOff)} {Math.floor(paidDaysOff) === 1 ? "dia" : "dias"} sem
                    trabalhar. Chuva, gripe ou pneu furado não viram mais desespero.
                  </p>
                </div>
              </Card>
            </Reveal>
          )}
        </div>
      )}

      {/* ajustes de meta */}
      <div className="mt-6">
        <SectionTitle>Ajustar metas</SectionTitle>
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5">
          <Field
            label="Meta de lucro líquido mensal"
            suffix="R$/mês"
            value={goal}
            onChange={setGoal}
            placeholder="3.800"
          />
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
              Dias de trabalho por semana
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDays(Math.max(1, days - 1))}
                className="pressable flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-300"
                aria-label="Menos dias"
              >
                <Minus className="h-4 w-4" />
              </button>
              <p className="tabular flex-1 text-center font-display text-[22px] font-bold text-zinc-50">
                {days} <span className="text-[13px] font-semibold text-zinc-500">dias/sem</span>
              </p>
              <button
                onClick={() => setDays(Math.min(7, days + 1))}
                className="pressable flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-300"
                aria-label="Mais dias"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-4 text-center text-[12.5px] text-zinc-400">
            Meta diária: <span className="font-bold text-volt-300">{brl(previewDaily)}</span>
            {" "}· semanal: <span className="font-bold text-zinc-200">{brl(previewDaily * days)}</span>
          </p>
          <button
            onClick={save}
            disabled={pending || !dirty}
            className="pressable mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-volt-400 py-3.5 font-display text-[14.5px] font-bold text-ink-950 disabled:opacity-40"
          >
            <Check className="h-5 w-5" strokeWidth={3} />
            {dirty ? "Salvar metas" : "Tudo certo por aqui"}
          </button>
        </div>
      </div>

      {!hasData && (
        <Link
          href="/registrar"
          className="pressable mt-4 block rounded-2xl border border-volt-400/30 bg-volt-400/10 py-3.5 text-center text-[13.5px] font-bold text-volt-300"
        >
          Registrar meu primeiro giro
        </Link>
      )}

      <Toast msg={msg} />
    </div>
  );
}
