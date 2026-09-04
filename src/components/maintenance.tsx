"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  Cog,
  Disc,
  Droplets,
  Gauge,
  PiggyBank,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import clsx from "clsx";
import { MAINT_META, brl, parseBR } from "@/lib/format";
import { Field, SectionTitle, ThinBar, Toast, useToast } from "@/components/ui";

export interface MaintStatusVM {
  type: string;
  label: string;
  hasRecord: boolean;
  kmDone: number;
  cost: number;
  intervalKm: number;
  remainingKm: number;
  pct: number;
  status: "ok" | "atencao" | "urgente" | "vencido" | "none";
}

export interface MaintHistoryItem {
  id: number;
  type: string;
  date: string;
  dateLabel: string;
  kmDone: number;
  cost: number;
}

const TYPE_ICONS: Record<string, typeof Wrench> = {
  oleo: Droplets,
  freios: Disc,
  relacao: Cog,
  pneus: CircleDot,
  revisao: ClipboardCheck,
  outro: Wrench,
};

const STATUS_STYLE = {
  ok: { bar: "bg-volt-400", text: "text-volt-300", border: "border-white/[0.07]" },
  atencao: { bar: "bg-amber-400", text: "text-amber-300", border: "border-amber-400/25" },
  urgente: { bar: "bg-rose-400", text: "text-rose-300", border: "border-rose-400/30" },
  vencido: { bar: "bg-rose-500", text: "text-rose-300", border: "border-rose-400/40" },
  none: { bar: "bg-zinc-500", text: "text-zinc-500", border: "border-white/[0.07]" },
} as const;

export function MaintenanceClient({
  today,
  odometer,
  vehicleLabel,
  statuses,
  monthMaintSpent,
  monthProvision,
  history,
}: {
  today: string;
  odometer: number;
  vehicleLabel: string;
  statuses: MaintStatusVM[];
  monthMaintSpent: number;
  monthProvision: number;
  history: MaintHistoryItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { msg, show } = useToast();
  const [open, setOpen] = useState(false);

  const [type, setType] = useState("oleo");
  const [kmDone, setKmDone] = useState("");
  const [cost, setCost] = useState("");
  const [interval, setIntervalV] = useState(String(MAINT_META.oleo.defaultInterval));

  const tracked = statuses.filter((s) => s.hasRecord);
  const order = { vencido: 0, urgente: 1, atencao: 2, ok: 3 };
  tracked.sort((a, b) => order[a.status as keyof typeof order] - order[b.status as keyof typeof order] || a.remainingKm - b.remainingKm);
  const untracked = statuses.filter((s) => !s.hasRecord);

  const save = () => {
    const kmValue = parseBR(kmDone) || odometer;
    if (kmValue <= 0) return;
    start(async () => {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          type,
          kmDone: kmValue,
          cost: parseBR(cost),
          intervalKm: parseBR(interval),
        }),
      });
      if (res.ok) {
        show(`${MAINT_META[type].label} registrada`);
        setKmDone(""); setCost("");
        setOpen(false);
        router.refresh();
      }
    });
  };

  const del = (id: number) => {
    start(async () => {
      await fetch(`/api/maintenance/${id}`, { method: "DELETE" });
      show("Registro removido");
      router.refresh();
    });
  };

  return (
    <div className="px-5 pb-10">
      <header className="flex items-center justify-between pb-5 pt-6">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-zinc-50">
            Oficina
          </h1>
          <p className="mt-1 text-[12.5px] text-zinc-500">
            Sua ferramenta de trabalho sempre pronta
          </p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="pressable flex h-10 items-center gap-1.5 rounded-full bg-volt-400 px-4 text-[13px] font-bold text-ink-950"
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} /> Registrar
        </button>
      </header>

      {/* odômetro */}
      <div className="flex items-center gap-4 rounded-3xl border border-white/[0.07] bg-gradient-to-b from-white/[0.045] to-white/[0.015] p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-volt-400/10 text-volt-400">
          <Gauge className="h-6 w-6" />
        </span>
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">
            Odômetro estimado · {vehicleLabel}
          </p>
          <p className="tabular font-display text-[28px] font-bold leading-tight text-zinc-50">
            {Math.round(odometer).toLocaleString("pt-BR")}{" "}
            <span className="text-[15px] font-semibold text-zinc-500">km</span>
          </p>
        </div>
      </div>

      {/* formulário expansível */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-3xl border border-volt-400/20 bg-volt-400/[0.04] p-5">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                Nova manutenção
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(MAINT_META).map(([key, meta]) => {
                  const Icon = TYPE_ICONS[key];
                  const active = type === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setType(key);
                        setIntervalV(String(meta.defaultInterval));
                      }}
                      className={clsx(
                        "pressable flex items-center gap-1.5 rounded-full border px-3 py-2 text-[11.5px] font-bold",
                        active
                          ? "border-volt-400/50 bg-volt-400/15 text-volt-300"
                          : "border-white/[0.08] bg-white/[0.03] text-zinc-500",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field
                  label="Km do serviço"
                  suffix="km"
                  value={kmDone}
                  onChange={setKmDone}
                  placeholder={String(Math.round(odometer))}
                />
                <Field label="Custo" suffix="R$" value={cost} onChange={setCost} placeholder="42" />
              </div>
              <div className="mt-3">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                  Próxima troca em
                </p>
                <div className="flex flex-wrap gap-2">
                  {[1000, 3000, 5000, 8000, 12000].map((v) => (
                    <button
                      key={v}
                      onClick={() => setIntervalV(String(v))}
                      className={clsx(
                        "pressable rounded-full border px-3 py-1.5 text-[11.5px] font-bold",
                        parseBR(interval) === v
                          ? "border-volt-400/50 bg-volt-400/15 text-volt-300"
                          : "border-white/[0.08] bg-white/[0.03] text-zinc-500",
                      )}
                    >
                      {v.toLocaleString("pt-BR")} km
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={save}
                disabled={pending}
                className="pressable mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-volt-400 py-3.5 font-display text-[14.5px] font-bold text-ink-950 disabled:opacity-40"
              >
                <Check className="h-5 w-5" strokeWidth={3} />
                Salvar manutenção
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* provisão vs gasto */}
      <div className="mt-4 flex items-center gap-4 rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
          <PiggyBank className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500">
            Caixinha da oficina (30 dias)
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-zinc-400">
            Provisionado <span className="font-bold text-volt-300">{brl(monthProvision)}</span>
            {" "}· gasto real{" "}
            <span className="font-bold text-zinc-200">{brl(monthMaintSpent)}</span>
          </p>
          <div className="mt-2.5">
            <ThinBar
              pct={monthProvision > 0 ? Math.min(1, monthMaintSpent / monthProvision) : monthMaintSpent > 0 ? 1 : 0}
              colorClass={monthMaintSpent <= monthProvision ? "bg-sky-400" : "bg-rose-400"}
            />
          </div>
          <p className="mt-1.5 text-[10.5px] text-zinc-500">
            {monthMaintSpent <= monthProvision
              ? "Sua caixinha cobre o gasto — continue provisionando."
              : "Gastou mais que o provisionado. Considere subir o R$/km nas configurações."}
          </p>
        </div>
      </div>

      {/* alertas por km */}
      <div className="mt-6">
        <SectionTitle>Vida útil por item</SectionTitle>
        {tracked.length === 0 && (
          <p className="rounded-3xl border border-dashed border-white/[0.1] py-8 text-center text-[13px] text-zinc-500">
            Nenhuma manutenção registrada ainda.
            <br />
            Toque em &quot;Registrar&quot; para começar a rastrear.
          </p>
        )}
        <div className="flex flex-col gap-2.5">
          {tracked.map((st) => {
            const Icon = TYPE_ICONS[st.type];
            const sty = STATUS_STYLE[st.status];
            const over = st.status === "vencido";
            return (
              <motion.div
                key={st.type}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={clsx("rounded-3xl border bg-white/[0.025] p-4", sty.border)}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-zinc-100">{st.label}</p>
                    <p className="text-[11px] text-zinc-500">
                      feita com {Math.round(st.kmDone).toLocaleString("pt-BR")} km
                      {st.cost > 0 && ` · ${brl(st.cost)}`}
                    </p>
                  </div>
                  <p className={clsx("tabular text-right text-[12.5px] font-bold", sty.text)}>
                    {over ? (
                      <>VENCIDA há {Math.round(Math.abs(st.remainingKm)).toLocaleString("pt-BR")} km</>
                    ) : st.status === "none" ? (
                      "sem rastreio"
                    ) : (
                      <>restam {Math.round(st.remainingKm).toLocaleString("pt-BR")} km</>
                    )}
                  </p>
                </div>
                <div className="mt-3">
                  <ThinBar
                    pct={Math.min(1, st.pct)}
                    colorClass={sty.bar}
                  />
                </div>
              </motion.div>
            );
          })}

          {untracked.length > 0 && (
            <div className="mt-2">
              <p className="mb-2 flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                <ChevronDown className="h-3 w-3" /> sem histórico
              </p>
              <div className="flex flex-wrap gap-2">
                {untracked.map((st) => {
                  const Icon = TYPE_ICONS[st.type];
                  return (
                    <button
                      key={st.type}
                      onClick={() => {
                        setType(st.type);
                        setIntervalV(String(MAINT_META[st.type].defaultInterval));
                        setOpen(true);
                      }}
                      className="pressable flex items-center gap-1.5 rounded-full border border-dashed border-white/[0.12] px-3 py-2 text-[11.5px] font-semibold text-zinc-500"
                    >
                      <Icon className="h-3.5 w-3.5" /> {st.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* histórico */}
      {history.length > 0 && (
        <div className="mt-6">
          <SectionTitle>Histórico de serviços</SectionTitle>
          <div className="overflow-hidden rounded-3xl border border-white/[0.07]">
            {history.map((h, i) => {
              const Icon = TYPE_ICONS[h.type] ?? Wrench;
              return (
                <div
                  key={h.id}
                  className={clsx(
                    "flex items-center gap-3 bg-white/[0.025] px-4 py-3",
                    i > 0 && "border-t border-white/[0.05]",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-400">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-zinc-200">
                      {MAINT_META[h.type]?.label ?? h.type}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {h.dateLabel} · {Math.round(h.kmDone).toLocaleString("pt-BR")} km
                    </p>
                  </div>
                  <span className="tabular text-[13px] font-bold text-zinc-300">
                    {h.cost > 0 ? brl(h.cost) : "—"}
                  </span>
                  <button
                    onClick={() => del(h.id)}
                    disabled={pending}
                    aria-label="Excluir"
                    className="pressable shrink-0 rounded-lg p-1.5 text-zinc-600 hover:text-rose-400 disabled:opacity-40"
                  >
                    <Trash2 className="h-[15px] w-[15px]" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Toast msg={msg} />
    </div>
  );
}
