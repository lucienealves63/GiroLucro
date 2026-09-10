"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Backpack,
  Check,
  Clock3,
  Fuel,
  LifeBuoy,
  MoreHorizontal,
  Package,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trash2,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { rideVerdict } from "@/lib/calculations";
import { brl, brlSign, parseBR } from "@/lib/format";
import type { PlatformMeta } from "@/lib/platforms";
import { resolvePlatformMeta } from "@/lib/platforms";
import { Field, MoneyInput, SectionTitle, Toast, useToast } from "@/components/ui";
import { VoiceButton } from "@/components/voice-button";
import {
  brlVoice,
  parseVoiceCommand,
  type VoiceCommandResult,
} from "@/lib/voice-commands";

export interface RegisterItem {
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

type Tab = "ganho" | "combustivel" | "alimentacao" | "borracharia" | "equipamento" | "outro";

const TABS: { id: Tab; label: string; icon: typeof Zap }[] = [
  { id: "ganho", label: "Ganho", icon: Zap },
  { id: "combustivel", label: "Combus.", icon: Fuel },
  { id: "alimentacao", label: "Marmita", icon: UtensilsCrossed },
  { id: "borracharia", label: "Borracha", icon: LifeBuoy },
  { id: "equipamento", label: "Equipo", icon: Backpack },
  { id: "outro", label: "Outro", icon: MoreHorizontal },
];

const QUICK_AMOUNTS: Record<string, number[]> = {
  combustivel: [20, 30, 40],
  alimentacao: [10, 15, 25],
  borracharia: [15, 25, 40],
  equipamento: [30, 60, 90],
  outro: [10, 25, 50],
};

const TYPE_COLORS: Record<string, string> = {
  combustivel: "#fbbf24",
  alimentacao: "#a78bfa",
  borracharia: "#fb7185",
  equipamento: "#2dd4bf",
  manutencao: "#fb923c",
  outro: "#a1a1aa",
};

const PERIODS = [
  { id: "manha", label: "Manhã" },
  { id: "tarde", label: "Tarde" },
  { id: "noite", label: "Noite" },
  { id: "madrugada", label: "Madrugada" },
] as const;

function periodNow(): string {
  const h = new Date().getHours();
  if (h < 6) return "madrugada";
  if (h < 12) return "manha";
  if (h < 18) return "tarde";
  return "noite";
}

export function RegisterClient({
  today,
  avgPerKm,
  avgPerHour,
  costPerKm,
  settings,
  items,
  grossToday,
  hasBaselines,
  platforms,
}: {
  today: string;
  avgPerKm: number;
  avgPerHour: number;
  costPerKm: number;
  settings: { kmPerLiter: number; fuelPrice: number; maintenancePerKm: number };
  items: RegisterItem[];
  grossToday: number;
  hasBaselines: boolean;
  platforms: PlatformMeta[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ganho");
  const [pending, start] = useTransition();
  const { msg, show } = useToast();

  const activePlatforms = useMemo(
    () => platforms.filter((p) => p.enabled !== false),
    [platforms],
  );

  // form ganho
  const [platform, setPlatform] = useState<string>(
    () => activePlatforms[0]?.id ?? "ifood",
  );
  const [period, setPeriod] = useState<string>(periodNow());
  const [gross, setGross] = useState("");
  const [hours, setHours] = useState("");
  const [tripKm, setTripKm] = useState("");
  const [quantity, setQuantity] = useState("");
  const [waitMin, setWaitMin] = useState("");
  const [settled, setSettled] = useState(true);

  // form gasto
  const [expAmount, setExpAmount] = useState("");
  const [odometer, setOdometer] = useState("");
  const [note, setNote] = useState("");

  // vale a pena
  const [vpValor, setVpValor] = useState("");
  const [vpKm, setVpKm] = useState("");
  const [vpMin, setVpMin] = useState("");

  // voz
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [voiceInterim, setVoiceInterim] = useState<string | null>(null);

  const platformMeta = resolvePlatformMeta(platform, platforms);
  const cat = platformMeta.category;
  const unit = platformMeta.unit;
  const isDelivery = cat === "delivery";

  const verdict = useMemo(() => {
    const v = parseBR(vpValor);
    const k = parseBR(vpKm);
    if (v <= 0 || k <= 0) return null;
    return rideVerdict(v, k, parseBR(vpMin), settings, avgPerKm, avgPerHour);
  }, [vpValor, vpKm, vpMin, settings, avgPerKm, avgPerHour]);

  const pickPlatform = (p: string) => {
    setPlatform(p);
    // direto/B2B costuma pagar na hora
    const meta = resolvePlatformMeta(p, platforms);
    setSettled(p === "direto" || meta.label.toLowerCase().includes("direto"));
  };

  const saveEntry = useCallback(() => {
    const g = parseBR(gross);
    if (g <= 0) return;
    start(async () => {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          platform,
          period,
          gross: g,
          hours: parseBR(hours),
          km: parseBR(tripKm),
          quantity: Math.max(1, Math.round(parseBR(quantity) || 1)),
          waitMinutes: parseBR(waitMin),
          settled,
        }),
      });
      if (res.ok) {
        const qty = Math.max(1, Math.round(parseBR(quantity) || 1));
        const meta = resolvePlatformMeta(platform, platforms);
        const delivery = meta.category === "delivery";
        const u = meta.unit;
        show(
          delivery
            ? `Bateria salva: + ${brl(g)} (${qty} ${u}s)`
            : `Giro salvo: + ${brl(g)}`,
        );
        setGross(""); setHours(""); setTripKm(""); setQuantity(""); setWaitMin("");
        setVoiceHint(null);
        router.refresh();
      }
    });
  }, [gross, today, platform, period, hours, tripKm, quantity, waitMin, settled, platforms, router, show, start]);

  const saveExpense = useCallback(() => {
    const a = parseBR(expAmount);
    if (a <= 0) return;
    if (tab === "ganho") return;
    start(async () => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          type: tab,
          amount: a,
          odometer: tab === "combustivel" && odometer ? parseBR(odometer) : null,
          note: note ? note : null,
        }),
      });
      if (res.ok) {
        show(`Gasto salvo: − ${brl(a)}`);
        setExpAmount(""); setOdometer(""); setNote("");
        setVoiceHint(null);
        router.refresh();
      }
    });
  }, [expAmount, tab, today, odometer, note, router, show, start]);

  const applyVoiceCommand = useCallback(
    (cmd: VoiceCommandResult) => {
      if (cmd.action === "cancel") {
        setVoiceHint(null);
        setVoiceInterim(null);
        show("Comando cancelado");
        return;
      }
      if (cmd.action === "clear") {
        setGross("");
        setHours("");
        setTripKm("");
        setQuantity("");
        setWaitMin("");
        setExpAmount("");
        setOdometer("");
        setNote("");
        setVoiceHint(null);
        show("Campos limpos");
        return;
      }

      if (cmd.tab) setTab(cmd.tab);
      if (cmd.platform) {
        setPlatform(cmd.platform);
        if (cmd.settled === undefined) {
          const m = resolvePlatformMeta(cmd.platform, platforms);
          setSettled(
            cmd.platform === "direto" ||
              m.label.toLowerCase().includes("direto"),
          );
        }
      }
      if (cmd.period) setPeriod(cmd.period);
      if (cmd.settled !== undefined) setSettled(cmd.settled);

      const targetTab = cmd.tab ?? tab;
      const isGain = targetTab === "ganho" || !!cmd.platform;

      if (isGain) {
        if (cmd.tab && cmd.tab !== "ganho" && !cmd.platform) {
          // tab de gasto
        } else {
          if (cmd.amount != null) setGross(brlVoice(cmd.amount));
          if (cmd.hours != null) setHours(brlVoice(cmd.hours));
          if (cmd.km != null) setTripKm(brlVoice(cmd.km));
          if (cmd.quantity != null) setQuantity(String(cmd.quantity));
          if (cmd.waitMinutes != null) setWaitMin(String(Math.round(cmd.waitMinutes)));
        }
      }

      if (!isGain || (cmd.tab && cmd.tab !== "ganho" && !cmd.platform)) {
        if (cmd.amount != null) setExpAmount(brlVoice(cmd.amount));
        if (cmd.note) setNote(cmd.note);
        if (cmd.km != null && (cmd.tab === "combustivel" || targetTab === "combustivel")) {
          setOdometer(brlVoice(cmd.km));
        }
      }

      setVoiceHint(cmd.summary);

      if (cmd.action === "save") {
        void (async () => {
          if (isGain && (cmd.tab === "ganho" || cmd.platform || targetTab === "ganho")) {
            const g = cmd.amount ?? parseBR(gross);
            if (g <= 0) {
              show("Diga o valor do ganho, ex.: \"ifood 50 reais\"");
              return;
            }
            const p = cmd.platform ?? platform;
            const per = cmd.period ?? period;
            const h = cmd.hours ?? parseBR(hours);
            const k = cmd.km ?? parseBR(tripKm);
            const q = cmd.quantity ?? Math.max(1, Math.round(parseBR(quantity) || 1));
            const w = cmd.waitMinutes ?? parseBR(waitMin);
            const metaP = resolvePlatformMeta(p, platforms);
            const s =
              cmd.settled ??
              (p === "direto" || metaP.label.toLowerCase().includes("direto")
                ? true
                : settled);
            const res = await fetch("/api/entries", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date: today,
                platform: p,
                period: per,
                gross: g,
                hours: h,
                km: k,
                quantity: q,
                waitMinutes: w,
                settled: s,
              }),
            });
            if (res.ok) {
              const delivery = metaP.category === "delivery";
              const u = metaP.unit;
              show(
                delivery
                  ? `Bateria salva por voz: + ${brl(g)} (${q} ${u}s)`
                  : `Giro salvo por voz: + ${brl(g)}`,
              );
              setGross("");
              setHours("");
              setTripKm("");
              setQuantity("");
              setWaitMin("");
              setVoiceHint(null);
              router.refresh();
            } else {
              show("Não foi possível salvar o giro");
            }
          } else {
            const a = cmd.amount ?? parseBR(expAmount);
            const t = (cmd.tab && cmd.tab !== "ganho" ? cmd.tab : tab) as Tab;
            if (t === "ganho" || a <= 0) {
              show("Diga o valor do gasto, ex.: \"combustível 40 reais\"");
              return;
            }
            const res = await fetch("/api/expenses", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                date: today,
                type: t,
                amount: a,
                odometer:
                  t === "combustivel" && (cmd.km != null || odometer)
                    ? (cmd.km ?? parseBR(odometer))
                    : null,
                note: cmd.note || note || null,
              }),
            });
            if (res.ok) {
              show(`Gasto salvo por voz: − ${brl(a)}`);
              setExpAmount("");
              setOdometer("");
              setNote("");
              setVoiceHint(null);
              router.refresh();
            } else {
              show("Não foi possível salvar o gasto");
            }
          }
        })();
      } else if (cmd.amount != null || cmd.platform || cmd.tab) {
        show(`Voz: ${cmd.summary}`);
      } else {
        show("Não entendi. Ex.: \"ifood 50 reais 8 entregas 3 horas\"");
      }
    },
    [
      tab,
      platform,
      period,
      gross,
      hours,
      tripKm,
      quantity,
      waitMin,
      settled,
      expAmount,
      odometer,
      note,
      today,
      platforms,
      router,
      show,
    ],
  );

  const onVoiceTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (!isFinal) {
        setVoiceInterim(text);
        return;
      }
      setVoiceInterim(null);
      const cmd = parseVoiceCommand(text, activePlatforms);
      applyVoiceCommand(cmd);
    },
    [applyVoiceCommand, activePlatforms],
  );

  const del = (item: RegisterItem) => {
    start(async () => {
      const url = item.kind === "entry" ? `/api/entries/${item.id}` : `/api/expenses/${item.id}`;
      await fetch(url, { method: "DELETE" });
      show("Removido");
      router.refresh();
    });
  };

  const grossNum = parseBR(gross);
  const qtyNum = Math.max(0, Math.round(parseBR(quantity)));

  return (
    <div className="px-5 pb-10">
      <header className="pb-5 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-bold tracking-tight text-zinc-50">
              Registrar
            </h1>
            <p className="mt-1 text-[12.5px] text-zinc-500">
              Digite ou fale — giros e gastos em segundos
            </p>
          </div>
        </div>
      </header>

      {/* comando de voz */}
      <div className="mb-4 rounded-3xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="flex items-center gap-3">
          <VoiceButton
            onTranscript={onVoiceTranscript}
            onError={(m) => show(m)}
            disabled={pending}
            size="md"
            label="Falar comando"
            listeningLabel="Ouvindo…"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-zinc-300">Comando de voz</p>
            <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
              Ex.: “ifood 50 reais 8 entregas 3 horas 42 km salvar”
            </p>
          </div>
        </div>
        <AnimatePresence>
          {(voiceInterim || voiceHint) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <p className="mt-3 rounded-2xl border border-volt-400/20 bg-volt-400/[0.06] px-3 py-2 text-[12px] leading-snug text-volt-300">
                {voiceInterim ? (
                  <>
                    <span className="font-bold">Ouvindo: </span>
                    {voiceInterim}
                  </>
                ) : (
                  <>
                    <span className="font-bold">Entendi: </span>
                    {voiceHint}
                  </>
                )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* tabs */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1.5">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                "pressable relative flex items-center justify-center gap-1.5 rounded-xl py-2.5",
                active ? "text-ink-950" : "text-zinc-500",
              )}
            >
              {active && (
                <motion.span
                  layoutId="tab-bg"
                  className="absolute inset-0 rounded-xl bg-volt-400"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <t.icon className="relative z-10 h-4 w-4" strokeWidth={2.4} />
              <span className="relative z-10 text-[11px] font-bold">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* formulários */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="mt-5"
        >
          {tab === "ganho" ? (
            <div className="flex flex-col gap-5">
              {/* plataformas */}
              <div className="grid grid-cols-3 gap-2">
                {activePlatforms.map((meta) => {
                  const active = platform === meta.id;
                  return (
                    <button
                      key={meta.id}
                      onClick={() => pickPlatform(meta.id)}
                      className={clsx(
                        "pressable rounded-2xl border py-3 text-center",
                        active ? "border-transparent" : "border-white/[0.08] bg-white/[0.03]",
                      )}
                      style={active ? { backgroundColor: meta.soft, borderColor: meta.color } : undefined}
                    >
                      <span
                        className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl font-display text-[11.5px] font-bold"
                        style={{ backgroundColor: meta.color, color: "#0b0d10" }}
                      >
                        {meta.initials}
                      </span>
                      <span
                        className={clsx(
                          "mt-1.5 block truncate px-1 text-[11px] font-bold",
                          active ? "text-zinc-100" : "text-zinc-500",
                        )}
                      >
                        {meta.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="-mt-2 text-center text-[11px] text-zinc-500">
                Gerencie seus apps em{" "}
                <Link
                  href="/configuracoes"
                  className="font-semibold text-volt-300 underline-offset-2 hover:underline"
                >
                  Configurações
                </Link>
              </p>

              {/* período */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                  Período
                </p>
                <div className="flex gap-2">
                  {PERIODS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPeriod(p.id)}
                      className={clsx(
                        "pressable flex-1 rounded-full border py-2 text-[11.5px] font-bold",
                        period === p.id
                          ? "border-volt-400/50 bg-volt-400/15 text-volt-300"
                          : "border-white/[0.08] bg-white/[0.03] text-zinc-500",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] px-4 py-6">
                <MoneyInput value={gross} onChange={setGross} autoFocus />
                {isDelivery && grossNum > 0 && qtyNum > 0 && (
                  <p className="tabular mt-2 text-center text-[12.5px] font-semibold text-volt-300">
                    ≈ {brl(grossNum / qtyNum)} por {unit}
                  </p>
                )}
                <div className="mt-4 flex justify-center gap-2">
                  {[10, 20, 50].map((v) => (
                    <button
                      key={v}
                      onClick={() =>
                        setGross(String((grossNum + v).toFixed(2)).replace(".", ","))
                      }
                      className="pressable rounded-full border border-white/[0.09] bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-bold text-zinc-400"
                    >
                      +{v}
                    </button>
                  ))}
                </div>
                {isDelivery && (
                  <p className="mt-3 text-center text-[11px] leading-relaxed text-zinc-500">
                    Modo bateria: some o total do período — ex.: 8 entregas, R$ 122, 3h, 42 km.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={isDelivery ? "Nº de entregas" : "Nº de corridas"}
                  suffix={isDelivery ? "entregas" : "corridas"}
                  value={quantity}
                  onChange={setQuantity}
                  placeholder={isDelivery ? "8" : "5"}
                />
                <Field
                  label="Tempo online"
                  suffix="horas"
                  value={hours}
                  onChange={setHours}
                  placeholder="2,5"
                />
                <Field
                  label="Distância total"
                  suffix="km"
                  value={tripKm}
                  onChange={setTripKm}
                  placeholder="32"
                />
                {isDelivery ? (
                  <Field
                    label="Espera em loja"
                    suffix="min"
                    value={waitMin}
                    onChange={setWaitMin}
                    placeholder="45"
                  />
                ) : (
                  <div />
                )}
              </div>

              {isDelivery && parseBR(tripKm) > 0 && qtyNum > 0 && (
                <div className="-mt-2 flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-3.5 py-2.5">
                  <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <p className="text-[11.5px] leading-snug text-zinc-400">
                    <span className="font-semibold text-amber-300">
                      {(parseBR(tripKm) / qtyNum).toFixed(1).replace(".", ",")} km por {unit}
                    </span>{" "}
                    — inclua o km de retorno até a zona de pedidos, ele também é custo.
                  </p>
                </div>
              )}

              {parseBR(tripKm) > 0 && (
                <p className="-mt-2 text-center text-[11.5px] text-zinc-500">
                  Custo estimado desse giro:{" "}
                  <span className="font-semibold text-amber-300">
                    {brl(parseBR(tripKm) * costPerKm)}
                  </span>{" "}
                  ({brl(costPerKm)}/km)
                </p>
              )}

              {/* repasse */}
              <button
                onClick={() => setSettled(!settled)}
                className={clsx(
                  "pressable flex items-center justify-between rounded-2xl border px-4 py-3",
                  settled
                    ? "border-volt-400/30 bg-volt-400/[0.07]"
                    : "border-white/[0.08] bg-white/[0.03]",
                )}
              >
                <span className="flex items-center gap-2.5 text-[12.5px] font-semibold text-zinc-300">
                  <Clock3 className={clsx("h-4 w-4", settled ? "text-volt-400" : "text-zinc-500")} />
                  {settled ? "Dinheiro já recebido (Pix/na hora)" : "Fica a receber (repasse do app)"}
                </span>
                <span
                  className={clsx(
                    "relative h-6 w-11 rounded-full transition-colors",
                    settled ? "bg-volt-400" : "bg-white/[0.12]",
                  )}
                >
                  <span
                    className={clsx(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-ink-950 transition-all",
                      settled ? "left-[22px]" : "left-0.5 bg-zinc-400",
                    )}
                  />
                </span>
              </button>

              <button
                onClick={saveEntry}
                disabled={pending || grossNum <= 0}
                className="pressable flex items-center justify-center gap-2 rounded-2xl bg-volt-400 py-4 font-display text-[15.5px] font-bold text-ink-950 disabled:opacity-40"
              >
                <Check className="h-5 w-5" strokeWidth={3} />
                {isDelivery ? "Salvar bateria de entregas" : "Salvar giro"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] px-4 py-6">
                <MoneyInput value={expAmount} onChange={setExpAmount} autoFocus />
                <div className="mt-4 flex justify-center gap-2">
                  {(QUICK_AMOUNTS[tab] ?? [10, 25, 50]).map((v) => (
                    <button
                      key={v}
                      onClick={() =>
                        setExpAmount(String((parseBR(expAmount) + v).toFixed(2)).replace(".", ","))
                      }
                      className="pressable rounded-full border border-white/[0.09] bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-bold text-zinc-400"
                    >
                      +{v}
                    </button>
                  ))}
                </div>
              </div>

              {tab === "combustivel" && (
                <Field
                  label="Odômetro (opcional)"
                  suffix="km"
                  value={odometer}
                  onChange={setOdometer}
                  placeholder="12.450"
                />
              )}
              {tab !== "combustivel" && (
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    Descrição (opcional)
                  </span>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      tab === "borracharia"
                        ? "Ex: furo no pneu traseiro"
                        : tab === "equipamento"
                          ? "Ex: mochila térmica, suporte"
                          : tab === "alimentacao"
                            ? "Ex: marmita, lanche"
                            : "Ex: estacionamento, pedágio"
                    }
                    maxLength={60}
                    className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-[14px] text-zinc-100 placeholder:text-zinc-700"
                  />
                </label>
              )}
              {tab === "borracharia" && (
                <p className="-mt-2 text-center text-[11.5px] leading-relaxed text-zinc-500">
                  Emergências na rua entram direto no lucro real do dia — a provisão de
                  manutenção continua guardada para revisões.
                </p>
              )}

              <button
                onClick={saveExpense}
                disabled={pending || parseBR(expAmount) <= 0}
                className="pressable flex items-center justify-center gap-2 rounded-2xl bg-volt-400 py-4 font-display text-[15.5px] font-bold text-ink-950 disabled:opacity-40"
              >
                <Check className="h-5 w-5" strokeWidth={3} />
                Salvar gasto
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ------------------------- VALE A PENA? ------------------------- */}
      <div className="mt-8">
        <SectionTitle right={<Sparkles className="h-3.5 w-3.5 text-volt-400" />}>
          Vale a pena aceitar?
        </SectionTitle>
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Oferta" suffix="R$" value={vpValor} onChange={setVpValor} placeholder="18" />
            <Field label="Km total" suffix="km" value={vpKm} onChange={setVpKm} placeholder="7" />
            <Field label="Tempo" suffix="min" value={vpMin} onChange={setVpMin} placeholder="40" />
          </div>
          <AnimatePresence>
            {verdict && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div
                  className={clsx(
                    "mt-4 flex items-center gap-3 rounded-2xl border px-4 py-3.5",
                    verdict.verdict === "boa"
                      ? "border-volt-400/30 bg-volt-400/10"
                      : verdict.verdict === "mediana"
                        ? "border-amber-400/30 bg-amber-400/10"
                        : "border-rose-400/30 bg-rose-400/10",
                  )}
                >
                  {verdict.verdict === "ruim" ? (
                    <ThumbsDown className="h-5 w-5 shrink-0 text-rose-400" />
                  ) : (
                    <ThumbsUp
                      className={clsx(
                        "h-5 w-5 shrink-0",
                        verdict.verdict === "boa" ? "text-volt-400" : "text-amber-400",
                      )}
                    />
                  )}
                  <div className="text-[12.5px] leading-snug">
                    <p
                      className={clsx(
                        "font-bold",
                        verdict.verdict === "boa"
                          ? "text-volt-300"
                          : verdict.verdict === "mediana"
                            ? "text-amber-300"
                            : "text-rose-300",
                      )}
                    >
                      {verdict.verdict === "boa"
                        ? "Boa — aceita e roda!"
                        : verdict.verdict === "mediana"
                          ? "Na média — você decide."
                          : "Abaixo da sua média."}
                    </p>
                    <p className="mt-0.5 text-zinc-400">
                      Líquido de <span className="font-semibold text-zinc-200">{brl(verdict.net)}</span>{" "}
                      · {brl(verdict.perKm)}/km
                      {verdict.perHour > 0 && <> · {brl(verdict.perHour)}/h</>}
                      {hasBaselines && <> · sua média: {brl(avgPerKm)}/km</>}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-zinc-500">
                      <Timer className="h-3 w-3" />
                      No tempo, inclua a espera no restaurante — ela corrói o R$/h.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!hasBaselines && !verdict && (
            <p className="mt-3 text-[11.5px] leading-relaxed text-zinc-500">
              Registre alguns giros e a gente aprende sua média para julgar cada corrida
              ou entrega comparando com o seu histórico.
            </p>
          )}
        </div>
      </div>

      {/* ---------------------------- HOJE ---------------------------- */}
      <div className="mt-8">
        <SectionTitle
          right={
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400">
              <Package className="h-3.5 w-3.5" /> {brl(grossToday)} bruto
            </span>
          }
        >
          Lançamentos de hoje
        </SectionTitle>
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/[0.1] py-10 text-center">
            <p className="text-[13px] font-medium text-zinc-500">
              Nada por aqui ainda.
              <br />
              Sua primeira bateria de hoje aparece aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-white/[0.07]">
            {items.map((item, i) => (
              <div
                key={`${item.kind}-${item.id}`}
                className={clsx(
                  "flex items-center gap-3 bg-white/[0.025] px-4 py-3",
                  i > 0 && "border-t border-white/[0.05]",
                )}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      item.kind === "entry"
                        ? resolvePlatformMeta(item.platform, platforms).color
                        : (TYPE_COLORS[item.platform] ?? "#a1a1aa"),
                  }}
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-zinc-200">{item.label}</p>
                  {item.sub && <p className="truncate text-[11px] text-zinc-500">{item.sub}</p>}
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
              </div>
            ))}
          </div>
        )}
      </div>

      <Toast msg={msg} />
    </div>
  );
}
