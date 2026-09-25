"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  Fuel,
  Gauge,
  Info,
  Medal,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import clsx from "clsx";
import { brl, num2 } from "@/lib/format";
import {
  AnimatedNumber,
  Card,
  Reveal,
  SectionTitle,
  Toast,
  useToast,
} from "@/components/ui";

export interface StationVM {
  key: string;
  label: string;
  fillUps: number;
  liters: number;
  spent: number;
  pricePerLiter: number | null;
  kmPerLiter: number | null;
  costPerKm: number | null;
  measuredSegments: number;
  measuredKm: number;
  wasted: number;
  monthlyImpact: number;
  rank: number;
  gapPct: number | null;
  lastDate: string;
}

export interface StationPeriodVM {
  days: number;
  stations: StationVM[];
  best: StationVM | null;
  worst: StationVM | null;
  rankedBy: "km_liter" | "price_liter";
  totalWasted: number;
  totalLiters: number;
  totalSpent: number;
  overallKmPerLiter: number | null;
  overallCostPerKm: number | null;
  measuredStations: number;
  unlabeledSpent: number;
}

export interface FillUpVM {
  id: number;
  dateLabel: string;
  amount: number;
  /** "7,2 L · R$ 5,56/L" (vazio quando não há litros). */
  litersLine: string;
  note: string | null;
  station: string | null;
}

type Period = "7" | "30" | "90";

const PERIODS: { id: Period; label: string }[] = [
  { id: "7", label: "7 dias" },
  { id: "30", label: "30 dias" },
  { id: "90", label: "90 dias" },
];

export function PostosClient({
  week,
  month,
  quarter,
  fillUps,
  kmPerLiterConfig,
  fuelPriceConfig,
  hasFuel,
}: {
  week: StationPeriodVM;
  month: StationPeriodVM;
  quarter: StationPeriodVM;
  fillUps: FillUpVM[];
  kmPerLiterConfig: number;
  fuelPriceConfig: number;
  hasFuel: boolean;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("30");
  const [pending, start] = useTransition();
  const { msg, show } = useToast();
  const cur = period === "7" ? week : period === "30" ? month : quarter;

  const del = (id: number) => {
    start(async () => {
      await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      show("Abastecimento removido");
      router.refresh();
    });
  };

  const ranked = cur.stations.filter((s) => s.costPerKm !== null);
  const bestCost = ranked.length > 0 ? Math.min(...ranked.map((s) => s.costPerKm!)) : 0;
  const compare =
    cur.best && cur.worst && cur.best.key !== cur.worst.key ? { best: cur.best, worst: cur.worst } : null;
  const anyOdometer = cur.stations.some((s) => s.measuredSegments > 0);

  return (
    <div className="px-5 pb-10">
      <header className="flex items-center justify-between pb-5 pt-6">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-bold tracking-tight text-zinc-50">
            Postos
          </h1>
          <p className="mt-1 text-[12.5px] text-zinc-500">
            Onde o combustível deixa mais lucro líquido
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
          <Fuel className="h-[18px] w-[18px] text-amber-400" />
        </div>
      </header>

      {!hasFuel ? (
        <Card className="py-12 text-center">
          <Fuel className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-4 text-[14px] font-medium text-zinc-300">
            Nenhum abastecimento registrado.
          </p>
          <p className="mx-auto mt-1.5 max-w-[280px] text-[12.5px] leading-relaxed text-zinc-500">
            Lance o combustível com <strong className="text-zinc-300">posto</strong>,{" "}
            <strong className="text-zinc-300">litros</strong> e{" "}
            <strong className="text-zinc-300">odômetro</strong> e eu comparo o lucro que
            cada um deixa.
          </p>
          <Link
            href="/registrar"
            className="pressable mt-5 inline-block rounded-2xl bg-volt-400 px-6 py-3 font-display text-[14px] font-bold text-ink-950"
          >
            Lançar combustível
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {/* período */}
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={clsx(
                  "pressable relative rounded-xl py-2.5 text-[12.5px] font-bold",
                  period === p.id ? "text-ink-950" : "text-zinc-500",
                )}
              >
                {period === p.id && (
                  <motion.span
                    layoutId="postos-period-bg"
                    className="absolute inset-0 rounded-xl bg-volt-400"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <span className="relative z-10">{p.label}</span>
              </button>
            ))}
          </div>

          {/* totais do combustível */}
          <div className="grid grid-cols-3 gap-2">
            <Mini label="Gasto em combustível" value={brl(cur.totalSpent, true)} />
            <Mini
              label="Custo por km"
              value={cur.overallCostPerKm !== null ? brl(cur.overallCostPerKm) : "—"}
              accent
            />
            <Mini
              label="Consumo medido"
              value={
                cur.overallKmPerLiter !== null ? `${num2(cur.overallKmPerLiter)} km/l` : "—"
              }
            />
          </div>

          {/* campeão */}
          {compare && (
            <Reveal>
              <Card className="relative overflow-hidden !p-0">
                <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-volt-400/10 blur-3xl" />
                <div className="p-5">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-volt-400">
                    <Crown className="h-3.5 w-3.5" /> Mais lucro líquido
                  </p>
                  <p className="mt-2 font-display text-[24px] font-bold leading-tight text-zinc-50">
                    {compare.best.label}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
                    {compare.best.costPerKm !== null ? (
                      <>
                        Custa{" "}
                        <span className="font-semibold text-zinc-100">
                          {brl(compare.best.costPerKm)} por km
                        </span>{" "}
                        contra {brl(compare.worst.costPerKm ?? 0)} no {compare.worst.label}
                        {compare.worst.gapPct !== null && (
                          <> — {(compare.worst.gapPct * 100).toFixed(0)}% mais caro</>
                        )}
                        .
                      </>
                    ) : (
                      <>
                        Litro a{" "}
                        <span className="font-semibold text-zinc-100">
                          {brl(compare.best.pricePerLiter ?? 0)}
                        </span>{" "}
                        contra {brl(compare.worst.pricePerLiter ?? 0)} no{" "}
                        {compare.worst.label}.
                      </>
                    )}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Box
                      label="a mais no bolso"
                      value={brl(compare.worst.wasted)}
                      sub={`nos últimos ${cur.days} dias`}
                    />
                    <Box
                      label="por mês"
                      value={brl(compare.worst.monthlyImpact)}
                      sub="se abastecer sempre lá"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-zinc-500">
                    <span>
                      {compare.best.fillUps} abastecimento
                      {compare.best.fillUps === 1 ? "" : "s"} · {num2(compare.best.liters)} L ·{" "}
                      {brl(compare.best.spent)}
                    </span>
                    {compare.best.kmPerLiter !== null && (
                      <span className="flex items-center gap-1">
                        <Gauge className="h-3 w-3" /> {num2(compare.best.kmPerLiter)} km/l
                      </span>
                    )}
                    {compare.best.pricePerLiter !== null && (
                      <span>{brl(compare.best.pricePerLiter)}/L</span>
                    )}
                  </div>
                </div>
              </Card>
            </Reveal>
          )}

          {/* ranking */}
          <div>
            <SectionTitle
              right={
                <span className="text-[11px] font-bold text-zinc-500">
                  {cur.rankedBy === "km_liter" ? "por R$/km" : "por R$/litro"}
                </span>
              }
            >
              Ranking dos postos
            </SectionTitle>
            {cur.stations.length === 0 ? (
              <Card className="py-10 text-center">
                <p className="text-[13px] text-zinc-500">
                  Nenhum abastecimento nos últimos {cur.days} dias.
                </p>
              </Card>
            ) : (
              <div className="flex flex-col gap-3">
                {cur.stations.map((s, i) => {
                  const isBest = compare?.best.key === s.key;
                  const width =
                    s.costPerKm !== null && bestCost > 0
                      ? (bestCost / s.costPerKm) * 100
                      : s.pricePerLiter !== null && cur.best?.pricePerLiter
                        ? (cur.best.pricePerLiter / s.pricePerLiter) * 100
                        : 0;
                  return (
                    <Reveal key={s.key} delay={i * 0.05}>
                      <div
                        className={clsx(
                          "rounded-3xl border p-4",
                          isBest
                            ? "border-volt-400/25 bg-volt-400/[0.06]"
                            : "border-white/[0.07] bg-white/[0.025]",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={clsx(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                              isBest ? "bg-volt-400 text-ink-950" : "bg-white/[0.06] text-zinc-400",
                            )}
                          >
                            {isBest ? (
                              <Medal className="h-4 w-4" strokeWidth={2.4} />
                            ) : (
                              <span className="font-display text-[13px] font-bold">{s.rank}</span>
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-bold text-zinc-100">
                              {s.label}
                            </p>
                            <p className="mt-0.5 text-[11px] text-zinc-500">
                              {s.fillUps} abastecimento{s.fillUps === 1 ? "" : "s"} ·{" "}
                              {num2(s.liters)} L · {brl(s.spent)}
                              {s.key === "" && " (lançamentos sem posto)"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                              {s.costPerKm !== null ? "R$/km" : "R$/litro"}
                            </p>
                            <p
                              className={clsx(
                                "tabular font-display text-[17px] font-bold",
                                isBest ? "text-volt-300" : "text-zinc-100",
                              )}
                            >
                              <AnimatedNumber
                                value={s.costPerKm ?? s.pricePerLiter ?? 0}
                                format={(v) => brl(v)}
                              />
                            </p>
                          </div>
                        </div>

                        {width > 0 && (
                          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                            <motion.div
                              className={clsx(
                                "h-full rounded-full",
                                isBest ? "bg-volt-400" : "bg-amber-400/70",
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(3, Math.min(100, width))}%` }}
                              transition={{ type: "spring", stiffness: 60, damping: 18, delay: 0.1 + i * 0.06 }}
                            />
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
                          {s.pricePerLiter !== null && (
                            <span className="text-zinc-500">
                              Litro:{" "}
                              <span className="font-semibold text-zinc-300">
                                {brl(s.pricePerLiter)}
                              </span>
                            </span>
                          )}
                          {s.kmPerLiter !== null ? (
                            <span className="flex items-center gap-1 text-zinc-500">
                              <Gauge className="h-3 w-3" />
                              <span className="font-semibold text-zinc-300">
                                {num2(s.kmPerLiter)} km/l
                              </span>
                              <span className="text-zinc-600">
                                ({s.measuredSegments} {s.measuredSegments === 1 ? "trecho" : "trechos"} ·{" "}
                                {Math.round(s.measuredKm)} km)
                              </span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-zinc-600">
                              <Info className="h-3 w-3" /> sem km/l medido
                            </span>
                          )}
                          {s.wasted > 0.5 && (
                            <span className="font-semibold text-amber-300">
                              − {brl(s.wasted)} de lucro ({brl(s.monthlyImpact)}/mês)
                            </span>
                          )}
                          {isBest && compare && (
                            <span className="font-semibold text-volt-300">referência do ranking</span>
                          )}
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            )}
          </div>

          {/* aviso de medição */}
          {!anyOdometer && cur.stations.length > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="text-[12.5px] leading-relaxed text-zinc-300">
                Ranking só pelo <strong className="text-zinc-100">preço do litro</strong>.
                Informe o <strong className="text-zinc-100">odômetro</strong> em dois
                abastecimentos seguidos (tanque cheio) e cada posto passa a ser medido em{" "}
                <strong className="text-zinc-100">km/l</strong> — aí a comparação vira
                custo por km, que é o que realmente come o lucro.
              </p>
            </div>
          )}

          {cur.unlabeledSpent > 0 && (
            <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[12px] leading-relaxed text-zinc-500">
              {brl(cur.unlabeledSpent)} em abastecimentos lançados{" "}
              <strong className="text-zinc-300">sem posto</strong>. Eles entram no gasto
              total, mas não competem no ranking.
            </p>
          )}

          {/* como calculamos */}
          <Card>
            <SectionTitle>Como o lucro por posto é calculado</SectionTitle>
            <ul className="flex flex-col gap-2 text-[12px] leading-relaxed text-zinc-400">
              <li>
                <strong className="text-zinc-200">R$/km = R$/litro ÷ km/l.</strong> É o que
                sai do lucro a cada quilômetro — por isso decide o ranking.
              </li>
              <li>
                <strong className="text-zinc-200">km/l por posto</strong> vem do odômetro:
                a distância entre dois abastecimentos dividida pelos litros do
                abastecimento anterior (tanque cheio → tanque cheio).
              </li>
              <li>
                <strong className="text-zinc-200">Diferença em R$</strong> é quanto o posto
                mais caro tirou do seu lucro no período, e a projeção mensal dessa
                diferença.
              </li>
              <li className="text-zinc-500">
                Sua configuração hoje: {num2(kmPerLiterConfig)} km/l e{" "}
                {brl(fuelPriceConfig)}/litro — usada no modo &quot;combustível
                estimado&quot;.
              </li>
            </ul>
            <Link
              href="/registrar"
              className="pressable mt-4 flex items-center justify-center gap-2 rounded-2xl bg-volt-400 py-3.5 font-display text-[14.5px] font-bold text-ink-950"
            >
              <Plus className="h-4 w-4" strokeWidth={3} /> Lançar abastecimento
            </Link>
          </Card>

          {/* abastecimentos recentes */}
          {fillUps.length > 0 && (
            <div>
              <SectionTitle>Abastecimentos</SectionTitle>
              <div className="overflow-hidden rounded-3xl border border-white/[0.07]">
                {fillUps.map((f, i) => (
                  <div
                    key={f.id}
                    className={clsx(
                      "flex items-center gap-3 bg-white/[0.025] px-4 py-3",
                      i > 0 && "border-t border-white/[0.05]",
                    )}
                  >
                    <Fuel
                      className={clsx(
                        "h-4 w-4 shrink-0",
                        f.station ? "text-amber-400" : "text-zinc-600",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-zinc-200">
                        {f.station ?? "Sem posto informado"}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {[f.dateLabel, f.litersLine, f.note].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="tabular ml-auto text-[13px] font-bold text-zinc-400">
                      − {brl(f.amount)}
                    </span>
                    <button
                      onClick={() => del(f.id)}
                      disabled={pending}
                      aria-label="Excluir abastecimento"
                      className="pressable shrink-0 rounded-lg p-1.5 text-zinc-600 hover:text-rose-400 disabled:opacity-40"
                    >
                      <Trash2 className="h-[15px] w-[15px]" />
                    </button>
                  </div>
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

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={clsx(
        "rounded-2xl border px-2.5 py-3 text-center",
        accent ? "border-volt-400/25 bg-volt-400/[0.08]" : "border-white/[0.07] bg-white/[0.03]",
      )}
    >
      <p className="text-[9px] font-bold uppercase leading-tight tracking-[0.08em] text-zinc-500">
        {label}
      </p>
      <p
        className={clsx(
          "tabular mt-1.5 font-display text-[15px] font-bold",
          accent ? "text-volt-300" : "text-zinc-100",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Box({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-zinc-500">{label}</p>
      <p className="tabular mt-1 font-display text-[19px] font-bold text-volt-300">{value}</p>
      <p className="mt-0.5 text-[10.5px] text-zinc-500">{sub}</p>
    </div>
  );
}
