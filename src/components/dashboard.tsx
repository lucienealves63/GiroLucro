"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Clock3,
  Fuel,
  Gauge,
  HandCoins,
  Lightbulb,
  Moon,
  Package,
  PiggyBank,
  Settings2,
  Sun,
  Timer,
  Trash2,
  TrendingUp,
  TriangleAlert,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import clsx from "clsx";
import type { DayStats, Insight } from "@/lib/calculations";
import { brl, brlSign, hrs, km as fmtKm } from "@/lib/format";
import { Logo } from "@/components/brand";
import { WeekBars, type WeekBarDatum } from "@/components/charts";
import { FirstRunEmpty } from "@/components/empty-state";
import {
  AnimatedNumber,
  Card,
  GoalRing,
  Reveal,
  SectionTitle,
  Toast,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/components/theme-provider";

export interface RecentItem {
  id: number;
  kind: "entry" | "expense";
  label: string;
  sub: string;
  amount: number;
  positive: boolean;
  platform: string;
  when: string;
  createdAt: number;
}

export interface DashboardVM {
  today: string;
  firstName: string;
  trialDaysLeft: number | null;
  dateLabel: string;
  hasAny: boolean;
  todayStats: DayStats;
  goal: number;
  goalPct: number;
  reserveToday: number;
  reservePct: number;
  repassPending: number;
  week: WeekBarDatum[];
  weekNet: number;
  alerts: { label: string; remainingKm: number; status: string }[];
  insights: Insight[];
  recents: RecentItem[];
  fuelMode: string;
  fixedToday: number;
  monthFixedLabel: string;
  daysWorked: number;
  upcomingEmpty: boolean;
}

const PLATFORM_DOT: Record<string, string> = {
  uber: "bg-zinc-200",
  "99": "bg-[#FFD300]",
  ifood: "bg-[#EA1D2C]",
  rappi: "bg-[#FF441F]",
  direto: "bg-emerald-400",
  outro: "bg-sky-300",
  combustivel: "bg-amber-400",
  alimentacao: "bg-violet-400",
  borracharia: "bg-rose-400",
  equipamento: "bg-teal-300",
  manutencao: "bg-orange-400",
};

const PLATFORM_HEX: Record<string, string> = {
  uber: "#E8E8E8",
  "99": "#FFD300",
  ifood: "#EA1D2C",
  rappi: "#FF441F",
  direto: "#34D399",
  outro: "#7DD3FC",
};

export function Dashboard({ vm }: { vm: DashboardVM }) {
  const d = vm.todayStats;
  const lucroPct = d.gross > 0 ? Math.max(0, d.net / d.gross) : 0;
  const hasToday = d.gross > 0;
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="px-5">
      {/* header */}
      <header className="flex items-center justify-between pb-5 pt-6">
        <Logo />
        <div className="flex items-center gap-2">
          {vm.trialDaysLeft !== null && (
            <Link
              href="/assinatura"
              className="pressable rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[10.5px] font-bold text-amber-300"
            >
              Teste: {vm.trialDaysLeft} {vm.trialDaysLeft === 1 ? "dia" : "dias"}
            </Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
            className="pressable flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-400"
          >
            {theme === "dark" ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </button>
          <Link
            href="/configuracoes"
            aria-label="Configurações"
            className="pressable flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-zinc-400"
          >
            <Settings2 className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </header>

      {vm.upcomingEmpty ? (
        <Reveal>
          <FirstRunEmpty />
        </Reveal>
      ) : (
        <div className="flex flex-col gap-6 pb-4">
          <p className="-mt-2 text-[12.5px] font-medium capitalize text-zinc-500">
            <span className="text-zinc-300 normal-case">Oi, {vm.firstName} · </span>
            {vm.dateLabel}
          </p>

          {/* ---------- HERO LUCRO REAL ---------- */}
          <Reveal>
            <Card className="relative overflow-hidden !p-0">
              <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-volt-400/10 blur-3xl" />
              <div className="p-5 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                      Lucro real hoje
                    </p>
                    <p
                      className={clsx(
                        "mt-2 font-display text-[46px] font-bold leading-none",
                        d.net >= 0 ? "text-zinc-50" : "text-rose-400",
                      )}
                    >
                      <AnimatedNumber value={d.net} format={(v) => brl(v)} />
                    </p>
                    <p className="mt-2.5 text-[13px] leading-snug text-zinc-400">
                      Você faturou <span className="font-semibold text-zinc-200">{brl(d.gross)}</span>
                      {hasToday ? (
                        <>
                          {" "}e sobraram{" "}
                          <span className="font-semibold text-volt-300">{brl(d.net)}</span>
                          {" "}— {(lucroPct * 100).toFixed(0)}% do bruto.
                        </>
                      ) : (
                        " hoje. Registre seu primeiro giro!"
                      )}
                    </p>
                    {(d.quantity > 0 || d.waitHours > 0.04) && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {d.quantity > 0 && (
                          <span className="flex items-center gap-1 rounded-full border border-white/[0.09] bg-white/[0.04] px-2.5 py-1 text-[10.5px] font-bold text-zinc-300">
                            <Package className="h-3 w-3 text-zinc-500" />
                            {d.quantity} {d.quantity === 1 ? "giro" : "giros"} · {brl(d.perDelivery)}/cada
                          </span>
                        )}
                        {d.waitHours > 0.04 && (
                          <span className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/[0.08] px-2.5 py-1 text-[10.5px] font-bold text-amber-300">
                            <Timer className="h-3 w-3" />
                            {Math.round(d.waitHours * 60)}min de espera
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <GoalRing pct={vm.goalPct} size={96} stroke={8}>
                    <span className="font-display text-[15px] font-bold text-zinc-100">
                      {Math.round(Math.max(0, vm.goalPct) * 100)}%
                    </span>
                    <span className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                      da meta
                    </span>
                  </GoalRing>
                </div>

                {/* breakdown */}
                <div className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-4">
                  <CostRow
                    icon={<TrendingUp className="h-3.5 w-3.5 text-volt-400" />}
                    label="Faturamento bruto"
                    value={d.gross}
                    positive
                  />
                  <CostRow
                    icon={<Fuel className="h-3.5 w-3.5 text-amber-400" />}
                    label={
                      vm.fuelMode === "actual"
                        ? "Combustível (registrado)"
                        : `Combustível (estim. ${fmtKm(d.km)})`
                    }
                    value={-d.fuelCost}
                  />
                  <CostRow
                    icon={<Wrench className="h-3.5 w-3.5 text-orange-400" />}
                    label="Provisão de manutenção"
                    value={-d.maintProv}
                  />
                  {d.food > 0 && (
                    <CostRow
                      icon={<UtensilsCrossed className="h-3.5 w-3.5 text-violet-400" />}
                      label="Alimentação na rua"
                      value={-d.food}
                    />
                  )}
                  {d.other > 0 && (
                    <CostRow
                      icon={<ArrowDownRight className="h-3.5 w-3.5 text-zinc-400" />}
                      label="Outros gastos"
                      value={-d.other}
                    />
                  )}
                  {d.emergency > 0 && (
                    <CostRow
                      icon={<ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />}
                      label="Emergências & equipamento"
                      value={-d.emergency}
                    />
                  )}
                  <CostRow
                    icon={<CalendarClock className="h-3.5 w-3.5 text-sky-400" />}
                    label={`Custos fixos/dia (${vm.monthFixedLabel}/mês)`}
                    value={-d.fixedShare}
                  />
                </div>
              </div>

              {!hasToday && (
                <Link
                  href="/registrar"
                  className="pressable flex items-center justify-center gap-2 border-t border-white/[0.06] bg-volt-400/10 py-3.5 text-[13.5px] font-bold text-volt-300"
                >
                  Registrar giro de hoje <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </Card>
          </Reveal>

          {/* ---------- STATS ---------- */}
          <Reveal delay={0.06}>
            <div className="grid grid-cols-4 gap-2">
              <Stat label="R$/hora" value={d.perHour} money accent />
              <Stat label="R$/km" value={d.perKm} money />
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-3 text-center">
                <p className="flex items-center justify-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                  <Clock3 className="h-3 w-3" /> online
                </p>
                <p className="tabular mt-1.5 font-display text-[15px] font-bold text-zinc-100">
                  {hrs(d.hours)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-2.5 py-3 text-center">
                <p className="flex items-center justify-center gap-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                  <Gauge className="h-3 w-3" /> rodou
                </p>
                <p className="tabular mt-1.5 font-display text-[15px] font-bold text-zinc-100">
                  {fmtKm(d.km)}
                </p>
              </div>
            </div>
          </Reveal>

          {/* ---------- ALERTAS + RESERVA + REPASSE ---------- */}
          {(vm.alerts.length > 0 || vm.reserveToday > 0 || vm.repassPending > 0) && (
            <Reveal delay={0.1}>
              <div className="flex flex-col gap-2.5">
                {vm.alerts.map((a) => (
                  <Link
                    key={a.label}
                    href="/manutencao"
                    className={clsx(
                      "pressable flex items-center gap-3 rounded-2xl border px-4 py-3",
                      a.status === "vencido" || a.status === "urgente"
                        ? "border-rose-400/25 bg-rose-400/[0.07]"
                        : "border-amber-400/25 bg-amber-400/[0.07]",
                    )}
                  >
                    <TriangleAlert
                      className={clsx(
                        "h-[18px] w-[18px] shrink-0",
                        a.status === "vencido" || a.status === "urgente"
                          ? "animate-pulse-soft text-rose-400"
                          : "text-amber-400",
                      )}
                    />
                    <p className="text-[12.5px] font-semibold leading-tight text-zinc-200">
                      {a.status === "vencido" ? (
                        <>
                          {a.label} <span className="text-rose-300">vencida</span> há{" "}
                          {Math.round(Math.abs(a.remainingKm))} km
                        </>
                      ) : (
                        <>
                          {a.label} em{" "}
                          <span className="text-amber-300">
                            {Math.round(a.remainingKm)} km
                          </span>
                        </>
                      )}
                    </p>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-zinc-500" />
                  </Link>
                ))}
                {vm.reserveToday > 0 && (
                  <div className="flex items-center gap-3 rounded-2xl border border-volt-400/20 bg-volt-400/[0.06] px-4 py-3">
                    <PiggyBank className="h-[18px] w-[18px] shrink-0 text-volt-400" />
                    <p className="text-[12.5px] font-medium leading-tight text-zinc-300">
                      Guarde{" "}
                      <span className="font-bold text-volt-300">{brl(vm.reserveToday)}</span>{" "}
                      de hoje ({vm.reservePct}%) no fundo dos dias fracos.
                    </p>
                  </div>
                )}
                {vm.repassPending > 0 && (
                  <Link
                    href="/comparar"
                    className="pressable flex items-center gap-3 rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] px-4 py-3"
                  >
                    <HandCoins className="h-[18px] w-[18px] shrink-0 text-sky-300" />
                    <p className="text-[12.5px] font-medium leading-tight text-zinc-300">
                      <span className="font-bold text-sky-300">{brl(vm.repassPending)}</span>{" "}
                      de repasse a cair dos apps.
                    </p>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-zinc-500" />
                  </Link>
                )}
              </div>
            </Reveal>
          )}

          {/* ---------- SEMANA ---------- */}
          <Reveal delay={0.14}>
            <Card>
              <SectionTitle
                right={
                  <span
                    className={clsx(
                      "tabular font-display text-[13px] font-bold",
                      vm.weekNet >= 0 ? "text-volt-300" : "text-rose-400",
                    )}
                  >
                    {brl(vm.weekNet)} líq.
                  </span>
                }
              >
                Últimos 7 dias · líquido/dia
              </SectionTitle>
              <WeekBars data={vm.week} />
            </Card>
          </Reveal>

          {/* ---------- INSIGHTS ---------- */}
          {vm.insights.length > 0 && (
            <Reveal delay={0.18}>
              <div>
                <SectionTitle
                  right={
                    <Link
                      href="/comparar"
                      className="flex items-center gap-1 text-[11px] font-bold text-volt-400"
                    >
                      Raio-X completo <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  }
                >
                  Leitura da sua semana
                </SectionTitle>
                <div className="flex flex-col gap-2">
                  {vm.insights.slice(0, 2).map((ins, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.08 }}
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
            </Reveal>
          )}

          {/* ---------- RECENTES ---------- */}
          {vm.recents.length > 0 && (
            <Reveal delay={0.22}>
              <Recents recents={vm.recents} />
            </Reveal>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- internos -------------------------------- */

function CostRow({
  icon,
  label,
  value,
  positive,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
        {icon}
      </span>
      <span className="min-w-0 truncate text-[12.5px] text-zinc-400">{label}</span>
      <span
        className={clsx(
          "tabular ml-auto text-[13px] font-semibold",
          positive ? "text-volt-300" : "text-zinc-300",
        )}
      >
        {positive ? `+ ${brl(value)}` : `− ${brl(Math.abs(value))}`}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  money,
  accent,
}: {
  label: string;
  value: number;
  money?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border px-2.5 py-3 text-center",
        accent
          ? "border-volt-400/25 bg-volt-400/[0.08]"
          : "border-white/[0.07] bg-white/[0.03]",
      )}
    >
      <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-zinc-500">{label}</p>
      <p
        className={clsx(
          "tabular mt-1.5 font-display text-[15px] font-bold",
          accent ? "text-volt-300" : "text-zinc-100",
        )}
      >
        {money ? brl(value) : value}
      </p>
    </div>
  );
}

function Recents({ recents }: { recents: RecentItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { msg, show } = useToast();

  const del = (item: RecentItem) => {
    start(async () => {
      const url = item.kind === "entry" ? `/api/entries/${item.id}` : `/api/expenses/${item.id}`;
      await fetch(url, { method: "DELETE" });
      show(item.kind === "entry" ? "Giro removido" : "Gasto removido");
      router.refresh();
    });
  };

  return (
    <div>
      <SectionTitle>Lançamentos recentes</SectionTitle>
      <div className="overflow-hidden rounded-3xl border border-white/[0.07]">
        {recents.map((item, i) => (
          <motion.div
            key={`${item.kind}-${item.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 + i * 0.04 }}
            className={clsx(
              "group flex items-center gap-3 bg-white/[0.025] px-4 py-3",
              i > 0 && "border-t border-white/[0.05]",
            )}
          >
            <span
              className={clsx(
                "h-2 w-2 shrink-0 rounded-full",
                PLATFORM_DOT[item.platform] ?? (item.kind === "entry" ? "" : "bg-zinc-400"),
              )}
              style={
                !PLATFORM_DOT[item.platform] && item.kind === "entry"
                  ? { backgroundColor: PLATFORM_HEX[item.platform] ?? "#a1a1aa" }
                  : undefined
              }
            />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-zinc-200">{item.label}</p>
              <p className="truncate text-[11px] text-zinc-500">
                {item.when}
                {item.sub ? ` · ${item.sub}` : ""}
              </p>
            </div>
            <span
              className={clsx(
                "tabular ml-auto text-[13px] font-bold",
                item.positive ? "text-volt-300" : "text-zinc-400",
              )}
            >
              {brlSign(item.positive ? item.amount : -item.amount)}
            </span>
            <button
              onClick={() => del(item)}
              disabled={pending}
              aria-label="Excluir"
              className="pressable shrink-0 rounded-lg p-1.5 text-zinc-600 hover:text-rose-400 disabled:opacity-40"
            >
              <Trash2 className="h-[15px] w-[15px]" />
            </button>
          </motion.div>
        ))}
      </div>
      <Toast msg={msg} />
    </div>
  );
}
