"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bike,
  Car,
  Check,
  Crown,
  Database,
  Eye,
  EyeOff,
  Fuel,
  Gauge,
  LogOut,
  Moon,
  Plus,
  Smartphone,
  Sun,
  Trash2,
  TriangleAlert,
  Wallet,
  Wrench,
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { brl, parseBR } from "@/lib/format";
import {
  CUSTOM_COLORS,
  PLATFORM_CATEGORIES,
  type PlatformCategory,
  type PlatformMeta,
} from "@/lib/platforms";
import { Field, SectionTitle, Toast, useToast } from "@/components/ui";
import { useTheme, type Theme } from "@/components/theme-provider";

export interface SettingsForm {
  vehicleType: string;
  vehicleName: string;
  kmPerLiter: number;
  fuelPrice: number;
  maintenancePerKm: number;
  fuelMode: string;
  monthlyRent: number;
  monthlyPhone: number;
  monthlyInsurance: number;
  initialOdometer: number;
}

export function SettingsClient({
  account,
  settings,
  costPerKm,
  monthlyFixed,
  dailyFixed,
  hasData,
  platforms: initialPlatforms,
}: {
  account: { name: string; email: string; planLabel: string; isPro: boolean };
  settings: SettingsForm;
  costPerKm: number;
  monthlyFixed: number;
  dailyFixed: number;
  hasData: boolean;
  platforms: PlatformMeta[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { msg, show } = useToast();
  const { theme, setTheme, ready: themeReady } = useTheme();

  const f = (n: number) => String(n).replace(".", ",");
  const [form, setForm] = useState({
    vehicleType: settings.vehicleType,
    vehicleName: settings.vehicleName,
    kmPerLiter: f(settings.kmPerLiter),
    fuelPrice: f(settings.fuelPrice),
    maintenancePerKm: f(settings.maintenancePerKm),
    fuelMode: settings.fuelMode,
    monthlyRent: f(settings.monthlyRent),
    monthlyPhone: f(settings.monthlyPhone),
    monthlyInsurance: f(settings.monthlyInsurance),
    initialOdometer: f(settings.initialOdometer),
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const [platforms, setPlatforms] = useState<PlatformMeta[]>(initialPlatforms);
  useEffect(() => {
    setPlatforms(initialPlatforms);
  }, [initialPlatforms]);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState<PlatformCategory>("delivery");
  const [newColor, setNewColor] = useState(CUSTOM_COLORS[0]);

  const liveCostPerKm =
    (parseBR(form.kmPerLiter) > 0 ? parseBR(form.fuelPrice) / parseBR(form.kmPerLiter) : 0) +
    parseBR(form.maintenancePerKm);
  const liveFixed = parseBR(form.monthlyRent) + parseBR(form.monthlyPhone) + parseBR(form.monthlyInsurance);

  const save = () => {
    start(async () => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleType: form.vehicleType,
          vehicleName: form.vehicleName,
          kmPerLiter: parseBR(form.kmPerLiter),
          fuelPrice: parseBR(form.fuelPrice),
          maintenancePerKm: parseBR(form.maintenancePerKm),
          fuelMode: form.fuelMode,
          monthlyRent: parseBR(form.monthlyRent),
          monthlyPhone: parseBR(form.monthlyPhone),
          monthlyInsurance: parseBR(form.monthlyInsurance),
          initialOdometer: parseBR(form.initialOdometer),
        }),
      });
      if (res.ok) {
        show("Configurações salvas");
        router.refresh();
      }
    });
  };

  const seed = () => {
    start(async () => {
      await fetch("/api/seed", { method: "POST" });
      show("Dados de exemplo carregados");
      router.refresh();
    });
  };

  const clear = () => {
    if (!window.confirm("Apagar TODOS os lançamentos, gastos e manutenções?")) return;
    start(async () => {
      await fetch("/api/seed?action=clear", { method: "POST" });
      show("Todos os dados foram apagados");
      router.refresh();
    });
  };

  const logout = () => {
    start(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/entrar");
      router.refresh();
    });
  };

  const applyPlatformsResponse = async (body: Record<string, unknown>, okMsg: string) => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.platforms)) {
      setPlatforms(data.platforms as PlatformMeta[]);
      show(okMsg);
      router.refresh();
      return true;
    }
    show(data.error ?? "Não foi possível atualizar os apps");
    return false;
  };

  const togglePlatform = (id: string) => {
    start(async () => {
      await applyPlatformsResponse({ togglePlatformId: id }, "Apps atualizados");
    });
  };

  const removePlatform = (p: PlatformMeta) => {
    const label = p.custom
      ? `Remover "${p.label}" da sua lista? Histórico antigo continua intacto.`
      : `Ocultar "${p.label}" da tela de registro? Você pode reativar depois.`;
    if (!window.confirm(label)) return;
    start(async () => {
      await applyPlatformsResponse(
        { removePlatformId: p.id },
        p.custom ? "App removido" : "App ocultado",
      );
    });
  };

  const addPlatform = () => {
    const label = newLabel.trim();
    if (label.length < 2) {
      show("Digite o nome do app (mín. 2 letras)");
      return;
    }
    start(async () => {
      const ok = await applyPlatformsResponse(
        {
          addPlatform: {
            label,
            category: newCategory,
            color: newColor,
            unit: newCategory === "delivery" ? "entrega" : "corrida",
          },
        },
        `"${label}" adicionado`,
      );
      if (ok) {
        setNewLabel("");
        setShowAdd(false);
        setNewCategory("delivery");
        setNewColor(CUSTOM_COLORS[(platforms.length + 1) % CUSTOM_COLORS.length]);
      }
    });
  };

  return (
    <div className="px-5 pb-10">
      <header className="pb-5 pt-6">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-zinc-50">
          Configurações
        </h1>
        <p className="mt-1 text-[12.5px] text-zinc-500">
          Ajuste fino para o lucro real ser preciso
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {/* conta */}
        <div>
          <SectionTitle>Sua conta</SectionTitle>
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-volt-400 font-display text-[18px] font-bold text-ink-950">
                {account.name.trim()[0]?.toUpperCase() ?? "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[16px] font-bold text-zinc-50">
                  {account.name}
                </p>
                <p className="truncate text-[12px] text-zinc-500">{account.email}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-volt-400/20 bg-volt-400/[0.06] px-3.5 py-2.5">
              <Crown className="h-4 w-4 shrink-0 text-volt-400" />
              <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-zinc-200">
                {account.planLabel}
              </p>
              {!account.isPro && (
                <Link
                  href="/assinatura"
                  className="pressable shrink-0 rounded-xl bg-volt-400 px-3 py-1.5 text-[11px] font-bold text-ink-950"
                >
                  Virar Pro
                </Link>
              )}
            </div>
            <button
              onClick={logout}
              disabled={pending}
              className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] py-3 text-[13px] font-bold text-zinc-300 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              Sair da conta
            </button>
          </div>
        </div>

        {/* aparência */}
        <div>
          <SectionTitle>Aparência</SectionTitle>
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="mb-3 text-[12.5px] leading-snug text-zinc-400">
              Escolha o tema do app. A preferência fica salva neste aparelho.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "dark" as Theme, label: "Escuro", icon: Moon, hint: "asfalto à noite" },
                  { id: "light" as Theme, label: "Claro", icon: Sun, hint: "pista de dia" },
                ] as const
              ).map((opt) => {
                const active = themeReady && theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={clsx(
                      "pressable flex flex-col items-start gap-1 rounded-2xl border px-3.5 py-3 text-left",
                      active
                        ? "border-volt-400/50 bg-volt-400/15"
                        : "border-white/[0.08] bg-white/[0.03]",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <opt.icon
                        className={clsx(
                          "h-4 w-4",
                          active ? "text-volt-300" : "text-zinc-500",
                        )}
                      />
                      <span
                        className={clsx(
                          "text-[13px] font-bold",
                          active ? "text-volt-300" : "text-zinc-300",
                        )}
                      >
                        {opt.label}
                      </span>
                    </span>
                    <span className="text-[10.5px] text-zinc-500">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* apps / formas de ganho */}
        <div>
          <SectionTitle
            right={
              <span className="text-[11px] font-bold text-zinc-400">
                {platforms.filter((p) => p.enabled !== false).length} ativos
              </span>
            }
          >
            Formas de ganho
          </SectionTitle>
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="mb-3 flex items-start gap-2 text-[12.5px] leading-snug text-zinc-400">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-volt-400" />
              Ative só os apps que você usa, oculte os demais ou cadastre um novo
              (Lalamove, James, particular…).
            </p>

            <div className="flex flex-col gap-2">
              {platforms.map((p) => {
                const on = p.enabled !== false;
                return (
                  <div
                    key={p.id}
                    className={clsx(
                      "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
                      on
                        ? "border-white/[0.08] bg-white/[0.03]"
                        : "border-white/[0.05] bg-white/[0.015] opacity-70",
                    )}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-[11px] font-bold"
                      style={{ backgroundColor: p.color, color: "#0b0d10" }}
                    >
                      {p.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-zinc-100">
                        {p.label}
                        {p.custom && (
                          <span className="ml-1.5 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                            seu
                          </span>
                        )}
                      </p>
                      <p className="text-[10.5px] text-zinc-500">
                        {p.category === "delivery" ? "Entrega" : "Corrida"} · {p.unit}
                        {!on && " · oculto"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePlatform(p.id)}
                      disabled={pending}
                      aria-label={on ? "Ocultar app" : "Ativar app"}
                      className="pressable rounded-xl border border-white/[0.08] p-2 text-zinc-400 hover:text-volt-300 disabled:opacity-40"
                    >
                      {on ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    {(p.custom || on) && (
                      <button
                        type="button"
                        onClick={() => removePlatform(p)}
                        disabled={pending}
                        aria-label={p.custom ? "Remover app" : "Ocultar app"}
                        className="pressable rounded-xl border border-rose-400/20 p-2 text-zinc-500 hover:text-rose-400 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <AnimatePresence>
              {showAdd && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-2xl border border-volt-400/25 bg-volt-400/[0.05] p-3.5">
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                        Nome do app
                      </span>
                      <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Ex: Lalamove, James, Particular"
                        maxLength={40}
                        className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-[14px] text-zinc-100 placeholder:text-zinc-700"
                      />
                    </label>
                    <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                      Tipo
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {PLATFORM_CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setNewCategory(c.id)}
                          className={clsx(
                            "pressable rounded-2xl border px-3 py-2.5 text-left",
                            newCategory === c.id
                              ? "border-volt-400/50 bg-volt-400/15"
                              : "border-white/[0.08] bg-white/[0.03]",
                          )}
                        >
                          <p
                            className={clsx(
                              "text-[12.5px] font-bold",
                              newCategory === c.id ? "text-volt-300" : "text-zinc-300",
                            )}
                          >
                            {c.label}
                          </p>
                          <p className="text-[10.5px] text-zinc-500">unidade: {c.unit}</p>
                        </button>
                      ))}
                    </div>
                    <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                      Cor
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CUSTOM_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColor(c)}
                          aria-label={`Cor ${c}`}
                          className={clsx(
                            "h-8 w-8 rounded-full border-2 transition",
                            newColor === c ? "border-zinc-50 scale-110" : "border-transparent",
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={addPlatform}
                        disabled={pending || newLabel.trim().length < 2}
                        className="pressable flex flex-1 items-center justify-center gap-2 rounded-2xl bg-volt-400 py-3 text-[13px] font-bold text-ink-950 disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" strokeWidth={3} />
                        Adicionar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAdd(false);
                          setNewLabel("");
                        }}
                        className="pressable rounded-2xl border border-white/[0.08] px-4 py-3 text-[13px] font-bold text-zinc-400"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showAdd && (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                disabled={pending}
                className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-volt-400/35 bg-volt-400/[0.06] py-3 text-[13px] font-bold text-volt-300 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" strokeWidth={2.6} />
                Adicionar novo app
              </button>
            )}
          </div>
        </div>

        {/* veículo */}
        <div>
          <SectionTitle>Seu veículo</SectionTitle>
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "moto", label: "Moto", icon: Bike },
                { id: "carro", label: "Carro", icon: Car },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setForm((p) => ({ ...p, vehicleType: v.id }))}
                  className={clsx(
                    "pressable flex items-center justify-center gap-2 rounded-2xl border py-3 text-[13.5px] font-bold",
                    form.vehicleType === v.id
                      ? "border-volt-400/50 bg-volt-400/15 text-volt-300"
                      : "border-white/[0.08] bg-white/[0.03] text-zinc-500",
                  )}
                >
                  <v.icon className="h-4.5 w-4.5" />
                  {v.label}
                </button>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                Apelido (opcional)
              </span>
              <input
                type="text"
                value={form.vehicleName}
                onChange={(e) => setForm((p) => ({ ...p, vehicleName: e.target.value }))}
                placeholder="Ex: Factor 150, Onix 2022"
                maxLength={40}
                className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-[14px] text-zinc-100 placeholder:text-zinc-700"
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Consumo médio" suffix="km/L" value={form.kmPerLiter} onChange={set("kmPerLiter")} placeholder="35" />
              <Field label="Preço combustível" suffix="R$/L" value={form.fuelPrice} onChange={set("fuelPrice")} placeholder="5,79" />
              <Field label="Provisão manutenção" suffix="R$/km" value={form.maintenancePerKm} onChange={set("maintenancePerKm")} placeholder="0,12" />
              <Field label="Odômetro inicial" suffix="km" value={form.initialOdometer} onChange={set("initialOdometer")} placeholder="12.000" />
            </div>

            {/* modo combustível */}
            <div className="mt-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                <Fuel className="h-3.5 w-3.5" /> Como calcular o combustível
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "estimate", label: "Estimar por km", hint: "automático" },
                  { id: "actual", label: "Usar abastecimento", hint: "o que você registra" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setForm((p) => ({ ...p, fuelMode: m.id }))}
                    className={clsx(
                      "pressable rounded-2xl border px-3 py-2.5 text-left",
                      form.fuelMode === m.id
                        ? "border-volt-400/50 bg-volt-400/15"
                        : "border-white/[0.08] bg-white/[0.03]",
                    )}
                  >
                    <p className={clsx("text-[12.5px] font-bold", form.fuelMode === m.id ? "text-volt-300" : "text-zinc-300")}>
                      {m.label}
                    </p>
                    <p className="text-[10.5px] text-zinc-500">{m.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-volt-400/20 bg-volt-400/[0.06] px-4 py-3">
              <p className="flex items-center gap-2 text-[12px] font-semibold text-zinc-300">
                <Gauge className="h-4 w-4 text-volt-400" />
                Seu custo por km rodado
              </p>
              <p className="tabular font-display text-[16px] font-bold text-volt-300">
                {brl(liveCostPerKm || costPerKm)}
              </p>
            </div>
          </div>
        </div>

        {/* custos fixos */}
        <div>
          <SectionTitle
            right={
              <span className="text-[11px] font-bold text-zinc-400">
                {brl(liveFixed || monthlyFixed)}/mês
              </span>
            }
          >
            Custos fixos mensais
          </SectionTitle>
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="grid grid-cols-1 gap-3">
              <Field label="Aluguel do veículo" suffix="R$/mês" value={form.monthlyRent} onChange={set("monthlyRent")} placeholder="0" />
              <Field label="Plano de celular" suffix="R$/mês" value={form.monthlyPhone} onChange={set("monthlyPhone")} placeholder="59,90" />
              <Field label="Seguro / proteção" suffix="R$/mês" value={form.monthlyInsurance} onChange={set("monthlyInsurance")} placeholder="89" />
            </div>
            <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <Wallet className="h-4 w-4 shrink-0 text-sky-300" />
              <p className="text-[12px] leading-snug text-zinc-400">
                Isso pesa{" "}
                <span className="font-bold text-zinc-100">{brl(liveFixed > 0 ? liveFixed / 26 : dailyFixed)}</span>{" "}
                por dia trabalhado — já descontado do lucro real.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={save}
          disabled={pending}
          className="pressable flex items-center justify-center gap-2 rounded-2xl bg-volt-400 py-4 font-display text-[15.5px] font-bold text-ink-950 disabled:opacity-40"
        >
          <Check className="h-5 w-5" strokeWidth={3} />
          Salvar configurações
        </button>

        {/* dados */}
        <div>
          <SectionTitle>Dados do app</SectionTitle>
          <div className="flex flex-col gap-2.5">
            {!hasData && (
              <button
                onClick={seed}
                disabled={pending}
                className="pressable flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-left disabled:opacity-50"
              >
                <Database className="h-[18px] w-[18px] shrink-0 text-volt-400" />
                <div>
                  <p className="text-[13px] font-bold text-zinc-200">Carregar dados de exemplo</p>
                  <p className="text-[11px] text-zinc-500">24 dias de giros, gastos e manutenção</p>
                </div>
              </button>
            )}
            {hasData && (
              <button
                onClick={clear}
                disabled={pending}
                className="pressable flex items-center gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.05] px-4 py-3.5 text-left disabled:opacity-50"
              >
                <Trash2 className="h-[18px] w-[18px] shrink-0 text-rose-400" />
                <div>
                  <p className="text-[13px] font-bold text-rose-300">Apagar todos os dados</p>
                  <p className="text-[11px] text-zinc-500">Lançamentos, gastos e manutenções</p>
                </div>
              </button>
            )}
            <div className="flex items-start gap-2.5 rounded-2xl border border-white/[0.05] px-4 py-3.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
              <p className="text-[11.5px] leading-relaxed text-zinc-500">
                Dica: revise o preço do combustível toda semana — é o número que mais
                muda seu lucro real. Manutenção sugerida: moto R$ 0,10–0,15/km, carro
                R$ 0,18–0,30/km. <Wrench className="inline h-3 w-3" />
              </p>
            </div>
          </div>
        </div>

        <p className="pb-2 pt-2 text-center text-[10.5px] font-medium tracking-wide text-zinc-600">
          GiroLucro · feito para quem vive na correria do asfalto
        </p>
      </div>

      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-40 bg-black/20"
          />
        )}
      </AnimatePresence>
      <Toast msg={msg} />
    </div>
  );
}
