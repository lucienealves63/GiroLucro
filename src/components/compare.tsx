"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Banknote,
  Crown,
  HandCoins,
  Lightbulb,
  Package,
  Swords,
  Timer,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import type { Insight } from "@/lib/calculations";
import { brl, hrs, km as fmtKm } from "@/lib/format";
import type { PlatformMeta } from "@/lib/platforms";
import { resolvePlatformMeta } from "@/lib/platforms";
import { AnimatedNumber, Card, Reveal, SectionTitle, Toast, useToast } from "@/components/ui";

export interface ComparePlatformVM {
  platform: string;
  gross: number;
  hours: number;
  km: number;
  trips: number;
  quantity: number;
  waitMin: number;
  net: number;
  perHour: number;
  perKm: number;
  perDelivery: number;
  kmPerDelivery: number;
  perHourNoWait: number;
  grossShare: number;
}

export interface ComparePeriodVM {
  gross: number;
  net: number;
  hours: number;
  km: number;
  perHour: number;
  perKm: number;
  platforms: ComparePlatformVM[];
}

export interface SettlementVM {
  platform: string;
  pending: number;
  received30: number;
}

export function CompareClient({
  week,
  month,
  insights,
  settlements,
  totalPending,
  hasData,
  platforms: userPlatforms = [],
}: {
  week: ComparePeriodVM;
  month: ComparePeriodVM;
  insights: Insight[];
  settlements: SettlementVM[];
  totalPending: number;
  hasData: boolean;
  platforms?: PlatformMeta[];
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<"7" | "30">("7");
  const [pending, start] = useTransition();
  const { msg, show } = useToast();
  const cur = period === "7" ? week : month;

  const bestHour = Math.max(...cur.platforms.map((p) => p.perHour), 0);
  const metaOf = (id: string) => resolvePlatformMeta(id, userPlatforms);

  const settle = (platform: string) => {
    start(async () => {
      await fetch("/api/entries/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      show(
        platform === "all"
          ? "Todos os repasses baixados"
          : `Repasse do ${metaOf(platform).label} marcado como recebido`,
      );
      router.refresh();
    });
  };

  return (
    <div className="px-5 pb-10">
      <header className="flex items-center justify-between pb-5 pt-6">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-zinc-50">
            Batalha dos apps
          </h1>
          <p className="mt-1 text-[12.5px] text-zinc-500">
            Corridas e entregas lado a lado — onde rende mais?
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
          <Swords className="h-[18px] w-[18px] text-volt-400" />
        </div>
      </header>

      {!hasData ? (
        <Card className="py-12 text-center">
          <p className="text-[14px] font-medium text-zinc-400">
            Sem dados para comparar ainda.
          </p>
          <p className="mt-1.5 text-[12.5px] text-zinc-500">
            Registre giros em duas plataformas ou mais e volte aqui.
          </p>
          <Link
            href="/registrar"
            className="pressable mt-5 inline-block rounded-2xl bg-volt-400 px-6 py-3 font-display text-[14px] font-bold text-ink-950"
          >
            Registrar agora
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {/* período */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1.5">
            {(["7", "30"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={clsx(
                  "pressable relative rounded-xl py-2.5 text-[12.5px] font-bold",
                  period === p ? "text-ink-950" : "text-zinc-500",
                )}
              >
                {period === p && (
                  <motion.span
                    layoutId="period-bg"
                    className="absolute inset-0 rounded-xl bg-volt-400"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative z-10">
                  {p === "7" ? "Últimos 7 dias" : "Últimos 30 dias"}
                </span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={period}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-6"
            >
              {/* totais */}
              <div className="grid grid-cols-3 gap-2">
                <MiniTotal label="Lucro líquido" value={brl(cur.net)} accent />
                <MiniTotal label="R$/hora" value={brl(cur.perHour)} />
                <MiniTotal label="R$/km" value={brl(cur.perKm)} />
              </div>

              {/* barra de participação */}
              {cur.platforms.length > 0 && (
                <div>
                  <SectionTitle>Participação no faturamento</SectionTitle>
                  <div className="flex h-4 w-full gap-1 overflow-hidden rounded-full">
                    {cur.platforms.map((p, i) => (
                      <motion.div
                        key={p.platform}
                        className="h-full rounded-full"
                        style={{ backgroundColor: metaOf(p.platform).color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${p.grossShare * 100}%` }}
                        transition={{ type: "spring", stiffness: 70, damping: 20, delay: i * 0.08 }}
                      />
                    ))}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                    {cur.platforms.map((p) => (
                      <span key={p.platform} className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: metaOf(p.platform).color }}
                        />
                        {metaOf(p.platform).label} {(p.grossShare * 100).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* cards por plataforma */}
              <div className="flex flex-col gap-3">
                {cur.platforms.map((p, idx) => {
                  const meta = metaOf(p.platform);
                  const isBest = p.perHour === bestHour && bestHour > 0;
                  const unit = meta.unit;
                  const waitShare = p.hours > 0 ? Math.round((p.waitMin / 60 / p.hours) * 100) : 0;
                  return (
                    <Reveal key={p.platform} delay={idx * 0.07}>
                      <div
                        className={clsx(
                          "relative overflow-hidden rounded-3xl border bg-gradient-to-b from-white/[0.045] to-white/[0.015] p-5",
                          isBest ? "border-volt-400/30" : "border-white/[0.07]",
                        )}
                      >
                        <div
                          className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full opacity-[0.13] blur-2xl"
                          style={{ backgroundColor: meta.color }}
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className="flex h-10 w-10 items-center justify-center rounded-xl font-display text-[13px] font-bold"
                              style={{ backgroundColor: meta.color, color: "#0b0d10" }}
                            >
                              {meta.initials}
                            </span>
                            <div>
                              <p className="flex items-center gap-1.5 font-display text-[16px] font-bold text-zinc-50">
                                {meta.label}
                                {isBest && (
                                  <span className="flex items-center gap-1 rounded-full bg-volt-400/15 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-volt-300">
                                    <Crown className="h-3 w-3" /> melhor R$/h
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-zinc-500">
                                {p.quantity > 0
                                  ? `${p.quantity} ${unit}${p.quantity > 1 ? "s" : ""}`
                                  : `${p.trips} giros`}{" "}
                                · {hrs(p.hours)} · {fmtKm(p.km)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                              líquido
                            </p>
                            <p className={clsx("tabular font-display text-[19px] font-bold", p.net >= 0 ? "text-volt-300" : "text-rose-400")}>
                              <AnimatedNumber value={p.net} format={brl} />
                            </p>
                          </div>
                        </div>

                        {/* R$/h race bar */}
                        <div className="mt-4">
                          <div className="flex items-baseline justify-between">
                            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                              lucro por hora
                            </span>
                            <span className="tabular font-display text-[15px] font-bold text-zinc-100">
                              {brl(p.perHour)}/h
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ backgroundColor: meta.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${bestHour > 0 ? (p.perHour / bestHour) * 100 : 0}%` }}
                              transition={{ type: "spring", stiffness: 60, damping: 18, delay: 0.15 + idx * 0.08 }}
                            />
                          </div>
                          {p.waitMin >= 20 && p.perHourNoWait > p.perHour * 1.05 && (
                            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-300/90">
                              <Timer className="h-3 w-3 shrink-0" />
                              {Math.round(p.waitMin)}min de espera ({waitShare}% do tempo) — sem ela seria{" "}
                              {brl(p.perHourNoWait)}/h.
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px]">
                            <span className="text-zinc-500">
                              Bruto: <span className="font-semibold text-zinc-300">{brl(p.gross)}</span>
                            </span>
                            <span className="text-zinc-500">
                              Por km: <span className="font-semibold text-zinc-300">{brl(p.perKm)}</span>
                            </span>
                            {p.quantity > 0 && (
                              <span className="flex items-center gap-1 text-zinc-500">
                                <Package className="h-3 w-3" />
                                <span className="font-semibold text-zinc-300">{brl(p.perDelivery)}</span>/{unit}
                              </span>
                            )}
                            {p.quantity > 2 && (
                              <span className="text-zinc-500">
                                <span className="font-semibold text-zinc-300">
                                  {p.kmPerDelivery.toFixed(1).replace(".", ",")}
                                </span>{" "}
                                km/{unit}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* ------------------------ REPASSES ------------------------ */}
          <Reveal delay={0.1}>
            <div>
              <SectionTitle
                right={
                  totalPending > 0 ? (
                    <button
                      onClick={() => settle("all")}
                      disabled={pending}
                      className="pressable text-[11px] font-bold text-volt-400 disabled:opacity-50"
                    >
                      Baixar tudo
                    </button>
                  ) : undefined
                }
              >
                Repasses & saldo a receber
              </SectionTitle>
              <div className="overflow-hidden rounded-3xl border border-white/[0.07]">
                <div className="flex items-center gap-3 bg-gradient-to-r from-sky-400/10 to-transparent px-4 py-3.5">
                  <HandCoins className="h-[18px] w-[18px] shrink-0 text-sky-300" />
                  <p className="text-[12.5px] text-zinc-300">
                    {totalPending > 0 ? (
                      <>
                        <span className="font-bold text-sky-300">{brl(totalPending)}</span>{" "}
                        ainda na mão dos apps
                      </>
                    ) : (
                      <span className="font-semibold text-zinc-300">Caixa em dia — nada a receber.</span>
                    )}
                  </p>
                </div>
                {settlements.length > 0 && (
                  <div className="border-t border-white/[0.05]">
                    {settlements.map((s) => {
                      const meta = metaOf(s.platform);
                      return (
                        <div
                          key={s.platform}
                          className="flex items-center gap-3 border-t border-white/[0.05] bg-white/[0.02] px-4 py-3 first:border-t-0"
                        >
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-[10px] font-bold"
                            style={{ backgroundColor: meta.color, color: "#0b0d10" }}
                          >
                            {meta.initials}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-zinc-200">{meta.label}</p>
                            <p className="text-[11px] text-zinc-500">
                              {s.received30 > 0 ? `recebido 30d: ${brl(s.received30)}` : "nada recebido em 30d"}
                            </p>
                          </div>
                          <span className={clsx("tabular text-[13px] font-bold", s.pending > 0 ? "text-sky-300" : "text-zinc-600")}>
                            {s.pending > 0 ? brl(s.pending) : "em dia"}
                          </span>
                          {s.pending > 0 && (
                            <button
                              onClick={() => settle(s.platform)}
                              disabled={pending}
                              className="pressable shrink-0 rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-[11px] font-bold text-sky-300 disabled:opacity-50"
                            >
                              Recebi
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {settlements.length === 0 && (
                  <p className="flex items-center gap-2 border-t border-white/[0.05] px-4 py-3.5 text-[12px] text-zinc-500">
                    <Banknote className="h-4 w-4" />
                    Registre giros marcando &quot;fica a receber&quot; para controlar os repasses semanais.
                  </p>
                )}
              </div>
            </div>
          </Reveal>

          {/* raio-x */}
          {insights.length > 0 && (
            <div>
              <SectionTitle>Raio-X estratégico</SectionTitle>
              <div className="flex flex-col gap-2">
                {insights.map((ins, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className={clsx(
                      "flex items-start gap-3 rounded-2xl border p-4",
                      ins.tone === "good"
                        ? "border-volt-400/20 bg-volt-400/[0.05]"
                        : ins.tone === "warn"
                          ? "border-amber-400/20 bg-amber-400/[0.05]"
                          : "border-white/[0.07] bg-white/[0.03]",
                    )}
                  >
                    <Lightbulb
                      className={clsx(
                        "mt-0.5 h-4 w-4 shrink-0",
                        ins.tone === "good"
                          ? "text-volt-400"
                          : ins.tone === "warn"
                            ? "text-amber-400"
                            : "text-sky-400",
                      )}
                    />
                    <p className="text-[12.5px] leading-relaxed text-zinc-300">{ins.text}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <Toast msg={msg} />
    </div>
  );
}

function MiniTotal({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border px-3 py-3.5 text-center",
        accent ? "border-volt-400/25 bg-volt-400/[0.08]" : "border-white/[0.07] bg-white/[0.03]",
      )}
    >
      <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-zinc-500">{label}</p>
      <p className={clsx("tabular mt-1.5 font-display text-[16px] font-bold", accent ? "text-volt-300" : "text-zinc-100")}>
        {value}
      </p>
    </div>
  );
}
