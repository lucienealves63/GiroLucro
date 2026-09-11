"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Clock3,
  Crown,
  Flame,
  Fuel,
  Gauge,
  HandCoins,
  Package,
  PiggyBank,
  ShieldCheck,
  Swords,
  Timer,
  TrendingUp,
  Wrench,
  Zap,
  Check,
} from "lucide-react";
import { Logo } from "@/components/brand";

type LandingProps = {
  isLogged: boolean;
};

const BENEFITS = [
  {
    icon: Banknote,
    title: "Lucro líquido real",
    desc: "Desconta combustível, manutenção por km, custos fixos rateados, marmita e imprevistos. Você vê o que sobra de verdade no bolso.",
    color: "text-volt-400",
    bg: "bg-volt-400/10",
    border: "border-volt-400/20",
  },
  {
    icon: Swords,
    title: "Batalha dos Apps",
    desc: "Uber × 99 × iFood × Rappi lado a lado: R$/hora, R$/km e R$/entrega líquidos. Descubra onde você realmente ganha mais.",
    color: "text-sky-300",
    bg: "bg-sky-400/10",
    border: "border-sky-400/25",
    highlight: true,
  },
  {
    icon: Timer,
    title: "Tempo de espera",
    desc: "Quanto tempo você perde mofando em restaurante? O app calcula e mostra quanto renderia sem a espera.",
    color: "text-amber-300",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
  },
  {
    icon: HandCoins,
    title: "Controle de repasses",
    desc: "Sabe quanto a Uber e iFood ainda te devem? Controle de saldo a receber vs. já recebido nos últimos 30 dias.",
    color: "text-sky-300",
    bg: "bg-sky-400/10",
    border: "border-sky-400/20",
  },
  {
    icon: Wrench,
    title: "Oficina inteligente",
    desc: "Alertas por km rodado: óleo, freios, relação, pneus. E caixinha da oficina com provisionado × gasto real.",
    color: "text-orange-300",
    bg: "bg-orange-400/10",
    border: "border-orange-400/20",
  },
  {
    icon: PiggyBank,
    title: "Metas e reserva",
    desc: "Meta mensal quebrada em meta diária, fundo de dias fracos e provisão de férias. Você no controle.",
    color: "text-emerald-300",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
  },
];

const BATTLE_MOCK = [
  { id: "99", label: "99", color: "#FFD300", perHour: 22.3, perKm: 1.35, share: 1, best: true },
  { id: "rappi", label: "Rappi", color: "#FF441F", perHour: 19.2, perKm: 1.18, share: 0.86 },
  { id: "uber", label: "Uber", color: "#E8E8E8", perHour: 18.5, perKm: 1.10, share: 0.83 },
  { id: "ifood", label: "iFood", color: "#EA1D2C", perHour: 16.8, perKm: 1.05, share: 0.75 },
];

export function LandingClient({ isLogged }: LandingProps) {
  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2">
      {/* ---------- HEADER ---------- */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#08090c]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between px-5 py-3.5 md:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            {isLogged ? (
              <Link
                href="/"
                className="pressable rounded-full bg-volt-400 px-4 py-2 text-[13px] font-bold text-ink-950"
              >
                Abrir app
              </Link>
            ) : (
              <>
                <Link
                  href="/entrar"
                  className="pressable hidden rounded-full px-4 py-2 text-[13px] font-semibold text-zinc-400 hover:text-zinc-100 md:block"
                >
                  Entrar
                </Link>
                <Link
                  href="/criar-conta"
                  className="pressable rounded-full bg-volt-400 px-4 py-2.5 text-[13px] font-bold text-ink-950 shadow-[0_0_24px_rgba(184,245,60,0.25)]"
                >
                  Começar grátis
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden bg-[#08090c]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-volt-400/[0.07] blur-[80px]" />
          <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-sky-500/[0.06] blur-[60px]" />
          <div className="absolute -bottom-20 -left-40 h-[400px] w-[400px] rounded-full bg-rose-500/[0.05] blur-[60px]" />
          <div className="texture-road absolute inset-0 opacity-[0.03]" />
        </div>

        <div className="relative mx-auto grid max-w-[1080px] gap-10 px-5 pb-16 pt-10 md:grid-cols-[1.1fr_0.9fr] md:items-center md:px-8 md:pb-24 md:pt-16">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="inline-flex items-center gap-2 rounded-full border border-volt-400/20 bg-volt-400/10 px-3 py-1.5"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-volt-400 text-[10px] font-bold text-ink-950">
                <Swords className="h-3 w-3" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-volt-300">
                Novo: Batalha dos Apps
              </span>
              <span className="rounded-full bg-volt-400 px-2 py-0.5 text-[10px] font-bold text-ink-950">HOT</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 90, damping: 18 }}
              className="mt-5 font-display text-[32px] font-bold leading-[0.95] tracking-tight text-zinc-50 md:text-[46px]"
            >
              Faturamento bruto{" "}
              <span className="relative">
                <span className="relative z-10 text-zinc-500 line-through decoration-2">não é lucro.</span>
              </span>
              <br />
              <span className="text-volt-400">Descubra quanto sobra de verdade.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="mt-4 max-w-[520px] text-[15px] leading-relaxed text-zinc-400 md:text-[16px]"
            >
              O <span className="font-semibold text-zinc-200">GiroLucro</span> foi feito para motoristas de app e motoboys
              que cansaram de trabalhar no escuro. Calculamos seu{" "}
              <span className="font-semibold text-zinc-200">lucro líquido por hora e por km</span> descontando
              combustível, manutenção, custos fixos e tempo de espera.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="mt-7 flex flex-col gap-3"
            >
              <Link
                href={isLogged ? "/" : "/criar-conta"}
                className="pressable group flex w-full items-center justify-center gap-2 rounded-2xl bg-volt-400 px-6 py-4 font-display text-[16px] font-bold text-ink-950 shadow-[0_0_32px_rgba(184,245,60,0.25)] md:w-fit"
              >
                <Zap className="h-5 w-5" />
                Começar 7 dias grátis
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <p className="flex items-center gap-2 text-[12px] text-zinc-500">
                <ShieldCheck className="h-4 w-4 text-volt-400" />
                <span>
                  <span className="font-semibold text-zinc-300">R$19,90 pagamento único</span> · vitalício · sem
                  mensalidade · cancela quando quiser
                </span>
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <div className="flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
                <div className="flex -space-x-2">
                  <div className="h-6 w-6 rounded-full border-2 border-[#08090c] bg-zinc-300" />
                  <div className="h-6 w-6 rounded-full border-2 border-[#08090c] bg-zinc-400" />
                  <div className="h-6 w-6 rounded-full border-2 border-[#08090c] bg-zinc-500" />
                </div>
                <span className="text-[11px] font-semibold text-zinc-400">+500 motoboys e motoristas</span>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> PWA instalável · funciona offline
              </span>
            </motion.div>
          </div>

          {/* MOCK BATALHA */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.25, type: "spring", stiffness: 70, damping: 18 }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 shadow-[0_24px_64px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-volt-400/10 blur-2xl" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-volt-400 text-ink-950">
                    <Swords className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-display text-[15px] font-bold leading-none text-zinc-50">Batalha dos apps</p>
                    <p className="mt-1 text-[11px] text-zinc-500">Últimos 7 dias · lucro líquido/hora</p>
                  </div>
                </div>
                <span className="rounded-full bg-volt-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-volt-300">
                  AO VIVO
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {BATTLE_MOCK.map((app, i) => (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.08 }}
                    className={`relative overflow-hidden rounded-2xl border p-3.5 ${
                      app.best ? "border-volt-400/30 bg-volt-400/[0.06]" : "border-white/[0.06] bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-lg font-display text-[11px] font-bold"
                          style={{ backgroundColor: app.color, color: "#0b0d10" }}
                        >
                          {app.label.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-[13px] font-semibold text-zinc-200">{app.label}</span>
                        {app.best && (
                          <span className="flex items-center gap-1 rounded-full bg-volt-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-950">
                            <Crown className="h-3 w-3" /> melhor
                          </span>
                        )}
                      </div>
                      <span className="tabular font-display text-[14px] font-bold text-volt-300">
                        R$ {app.perHour.toFixed(2).replace(".", ",")}/h
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: app.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${app.share * 100}%` }}
                        transition={{ delay: 0.6 + i * 0.08, type: "spring", stiffness: 60, damping: 18 }}
                      />
                    </div>
                    <div className="mt-2 flex gap-3 text-[10.5px] text-zinc-500">
                      <span>
                        R$ {app.perKm.toFixed(2).replace(".", ",")}/km
                      </span>
                      <span>· {app.share === 1 ? "100%" : `${Math.round(app.share * 100)}%`} do melhor</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-volt-400/10 px-3.5 py-2.5">
                <p className="flex items-start gap-2 text-[11.5px] leading-snug text-volt-200">
                  <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-volt-400" />
                  <span>
                    <span className="font-bold">99 está pagando 20% a mais</span> que iFood nessa semana. Vale a pena
                    focar lá entre 18h-22h.
                  </span>
                </p>
              </div>
            </div>

            {/* floating badges */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="absolute -bottom-4 -left-3 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#101216] px-3.5 py-2.5 shadow-xl md:-left-6"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/15">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Lucro líquido hoje</p>
                <p className="tabular font-display text-[14px] font-bold text-zinc-50">R$ 127,40</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="absolute -right-2 -top-3 hidden items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#101216] px-3.5 py-2.5 shadow-xl md:flex"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-400/15">
                <Clock3 className="h-4 w-4 text-sky-300" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tempo de espera</p>
                <p className="tabular font-display text-[13px] font-bold text-amber-300">47min perdidos</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ---------- BENEFICIOS GRID ---------- */}
      <section className="bg-[#0a0b0e] py-14 md:py-20">
        <div className="mx-auto max-w-[1080px] px-5 md:px-8">
          <div className="mx-auto max-w-[640px] text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-volt-400">Por que GiroLucro?</p>
            <h2 className="mt-3 font-display text-[26px] font-bold leading-tight tracking-tight text-zinc-50 md:text-[36px]">
              Você não precisa de mais corridas.
              <br />
              <span className="text-zinc-500">Precisa saber onde ganha mais.</span>
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-zinc-400">
              A maioria dos apps mostra só o bruto. O GiroLucro desconta tudo que te faz perder dinheiro e mostra o
              líquido real — por hora, por km e por entrega.
            </p>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.06, type: "spring", stiffness: 80, damping: 18 }}
                className={`group relative overflow-hidden rounded-[20px] border p-5 text-left ${
                  b.highlight ? "border-sky-400/30 bg-sky-400/[0.06] md:col-span-1" : "border-white/[0.06] bg-white/[0.02]"
                }`}
              >
                {b.highlight && (
                  <span className="absolute right-4 top-4 rounded-full bg-sky-400 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-ink-950">
                    MAIS USADO
                  </span>
                )}
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${b.bg} ${b.border} border`}>
                  <b.icon className={`h-5 w-5 ${b.color}`} />
                </div>
                <h3 className="mt-4 font-display text-[16px] font-bold text-zinc-50">{b.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- BATALHA DESTAQUE ---------- */}
      <section className="relative overflow-hidden border-y border-white/[0.06] bg-[#0c0e12] py-14 md:py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-volt-400/[0.04] blur-[80px]" />
        </div>
        <div className="relative mx-auto grid max-w-[1080px] gap-10 px-5 md:grid-cols-2 md:items-center md:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1">
              <Swords className="h-3.5 w-3.5 text-sky-300" />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-300">Função mais forte</span>
            </div>
            <h2 className="mt-4 font-display text-[28px] font-bold leading-[0.95] tracking-tight text-zinc-50 md:text-[38px]">
              Batalha dos Apps:
              <br />
              <span className="text-volt-400">onde você ganha mais por hora?</span>
            </h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-zinc-400">
              Você trabalha em 2, 3 apps ao mesmo tempo e nunca sabe qual compensa. A Batalha compara{" "}
              <span className="font-semibold text-zinc-200">Uber, 99, iFood, Rappi e Direto</span> lado a lado com seu
              custo real rateado proporcionalmente.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              {[
                { t: "Lucro líquido por hora", d: "Desconta combustível, manutenção e fixos proporcionalmente" },
                { t: "Lucro por km e por entrega", d: "Veja km/entrega e R$/entrega real" },
                { t: "Tempo de espera descontado", d: "Mostra quanto você perde mofando em loja e quanto seria sem isso" },
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-volt-400/15">
                    <Check className="h-3.5 w-3.5 text-volt-400" strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold text-zinc-100">{item.t}</p>
                    <p className="text-[12.5px] text-zinc-500">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href={isLogged ? "/comparar" : "/criar-conta"}
              className="pressable mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-[14px] font-bold text-ink-950"
            >
              <Swords className="h-4 w-4" />
              {isLogged ? "Ver minha batalha agora" : "Testar minha batalha grátis"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#08090c]">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Exemplo real · 7 dias</p>
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                  <span className="h-2 w-2 rounded-full bg-white/20" />
                  <span className="h-2 w-2 rounded-full bg-volt-400" />
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-volt-400/20 bg-volt-400/[0.06] p-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">Líquido</p>
                    <p className="mt-1 font-display text-[18px] font-bold text-volt-300">R$ 412</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">R$/hora</p>
                    <p className="mt-1 font-display text-[18px] font-bold text-zinc-100">R$ 19,80</p>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">R$/km</p>
                    <p className="mt-1 font-display text-[18px] font-bold text-zinc-100">R$ 1,22</p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex h-3 w-full overflow-hidden rounded-full">
                    {BATTLE_MOCK.map((p) => (
                      <div key={p.id} className="h-full" style={{ width: `${p.share * 25}%`, backgroundColor: p.color }} />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {BATTLE_MOCK.map((p) => (
                      <span key={p.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.label} {Math.round(p.share * 100)}%
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-3.5">
                  <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    <Timer className="h-3.5 w-3.5" /> Raio-X estratégico
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-300">
                    Você perdeu <span className="font-bold text-amber-300">3h12min</span> esperando em restaurante essa
                    semana. Sem essa espera, seu R$/hora iria de{" "}
                    <span className="font-semibold">R$ 19,80</span> para{" "}
                    <span className="font-bold text-volt-300">R$ 23,40</span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-volt-400/10 blur-2xl" />
          </div>
        </div>
      </section>

      {/* ---------- COMO FUNCIONA ---------- */}
      <section className="bg-[#08090c] py-14 md:py-20">
        <div className="mx-auto max-w-[1080px] px-5 md:px-8">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="md:col-span-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Como funciona</p>
              <h3 className="mt-3 font-display text-[24px] font-bold leading-tight text-zinc-50 md:text-[28px]">
                3 passos pra saber se valeu a pena o dia
              </h3>
            </div>
            <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
              {[
                { n: "01", t: "Registre em 10s", d: "Valor, km, horas e app. Tem comando de voz pra não parar a moto.", icon: Package },
                { n: "02", t: "App calcula tudo", d: "Combustível, manutenção por km, fixos rateados e espera.", icon: Fuel },
                { n: "03", t: "Veja onde ganha mais", d: "Batalha dos apps mostra R$/h líquido e te diz onde focar.", icon: Swords },
              ].map((s) => (
                <div key={s.n} className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-5">
                  <div className="flex items-center justify-between">
                    <s.icon className="h-5 w-5 text-volt-400" />
                    <span className="font-display text-[13px] font-bold text-zinc-600">{s.n}</span>
                  </div>
                  <p className="mt-4 font-display text-[16px] font-bold text-zinc-50">{s.t}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- PREÇO ---------- */}
      <section className="relative overflow-hidden bg-[#0a0b0e] py-14 md:py-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-volt-400/[0.05] blur-[90px]" />
        </div>
        <div className="relative mx-auto max-w-[1080px] px-5 md:px-8">
          <div className="mx-auto max-w-[760px] rounded-[28px] border border-volt-400/30 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-6 md:p-8">
            <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-volt-400 px-3 py-1">
                  <Crown className="h-3.5 w-3.5 text-ink-950" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-950">Pagamento único</span>
                </div>
                <h3 className="mt-4 font-display text-[28px] font-bold leading-tight text-zinc-50 md:text-[34px]">
                  R$ 19,90 uma vez.
                  <br />
                  <span className="text-volt-400">Vitalício.</span>
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-zinc-400">
                  Sem mensalidade. Sem renovação automática. Pague uma vez e use para sempre. Menos que 1 litro de
                  gasolina pra saber quanto você realmente lucra todo mês.
                </p>

                <div className="mt-6 flex flex-col gap-2.5">
                  {[
                    "7 dias grátis para testar tudo",
                    "Batalha dos apps completa",
                    "Lucro real automático e calculadora 'vale a pena?'",
                    "Oficina, metas, repasses e reserva",
                    "PWA instalável, funciona offline",
                    "Suporte direto no WhatsApp",
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2.5 text-[13px] text-zinc-300">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-volt-400 text-ink-950">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {f}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col">
                <div className="rounded-[20px] border border-white/[0.07] bg-[#08090c] p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Plano Pro</p>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-[42px] font-bold leading-none text-zinc-50">R$ 19,90</span>
                    <span className="text-[13px] font-semibold text-zinc-500">uma vez</span>
                  </div>
                  <p className="mt-2 text-[12px] font-medium text-volt-300">Pagamento único · acesso total sem mensalidade</p>

                  <div className="mt-5 rounded-xl bg-white/[0.04] px-3 py-2.5">
                    <p className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" /> Teste grátis de 7 dias incluído
                    </p>
                  </div>

                  <Link
                    href={isLogged ? "/assinatura" : "/criar-conta"}
                    className="pressable mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-volt-400 py-4 font-display text-[15px] font-bold text-ink-950"
                  >
                    <Zap className="h-5 w-5" />
                    {isLogged ? "Liberar Pro agora" : "Começar teste grátis"}
                  </Link>

                  <Link
                    href={isLogged ? "/" : "/entrar"}
                    className="pressable mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] py-3 text-[13px] font-bold text-zinc-300"
                  >
                    {isLogged ? "Voltar ao app" : "Já tenho conta · Entrar"}
                  </Link>

                  <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10.5px] leading-relaxed text-zinc-600">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    Pagamento seguro via Mercado Pago · Pix e cartão
                  </p>
                </div>

                <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] p-3.5">
                  <p className="text-[12px] font-semibold leading-snug text-amber-200">
                    💡 Cálculo rápido: se a Batalha te mostra que 99 paga R$ 3/h a mais e você roda 6h/dia, são{" "}
                    <span className="font-bold text-amber-100">R$ 360/mês a mais</span> só de escolher o app certo.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-6 flex max-w-[760px] flex-wrap justify-center gap-2">
            {[
              { icon: Gauge, label: "R$/hora real" },
              { icon: Fuel, label: "Combustível & manutenção" },
              { icon: Swords, label: "Batalha dos apps" },
              { icon: Timer, label: "Tempo de espera" },
              { icon: HandCoins, label: "Repasses" },
            ].map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-zinc-400"
              >
                <b.icon className="h-3.5 w-3.5 text-zinc-500" />
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA FINAL ---------- */}
      <section className="bg-[#08090c] py-14 md:py-20">
        <div className="mx-auto max-w-[1080px] px-5 md:px-8">
          <div className="relative overflow-hidden rounded-[28px] border border-volt-400/20 bg-gradient-to-br from-volt-400/[0.12] via-volt-400/[0.04] to-transparent p-8 md:p-12">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-volt-400/15 blur-3xl" />
            <div className="relative grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
              <div>
                <h3 className="font-display text-[28px] font-bold leading-[0.95] tracking-tight text-zinc-50 md:text-[38px]">
                  Pare de trabalhar no escuro.
                  <br />
                  <span className="text-volt-400">Comece a girar com lucro hoje.</span>
                </h3>
                <p className="mt-4 max-w-[520px] text-[14px] leading-relaxed text-zinc-400">
                  Em 2 minutos você cria sua conta e já vê sua primeira Batalha dos Apps. Teste grátis por 7 dias, sem
                  cartão. Se não curtir, não paga nada.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={isLogged ? "/" : "/criar-conta"}
                    className="pressable inline-flex items-center justify-center gap-2 rounded-2xl bg-volt-400 px-7 py-4 font-display text-[15px] font-bold text-ink-950"
                  >
                    <Zap className="h-5 w-5" />
                    Criar conta grátis
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <Link
                    href={isLogged ? "/comparar" : "/entrar"}
                    className="pressable inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-7 py-4 text-[14px] font-bold text-zinc-200"
                  >
                    {isLogged ? "Ver Batalha dos Apps" : "Já tenho conta"}
                  </Link>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="rounded-[20px] border border-white/[0.06] bg-[#0c0e12] p-5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500">O que você vai ver</p>
                  <div className="mt-4 flex flex-col gap-3">
                    {[
                      { k: "Hoje", v: "R$ 127,40 líquido", icon: Banknote },
                      { k: "Melhor app", v: "99 · R$ 22,30/h", icon: Crown },
                      { k: "A receber", v: "R$ 284,50 dos apps", icon: HandCoins },
                    ].map((r) => (
                      <div key={r.k} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3.5 py-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06]">
                          <r.icon className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{r.k}</p>
                          <p className="text-[13px] font-semibold text-zinc-100">{r.v}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="border-t border-white/[0.06] bg-[#08090c] py-10">
        <div className="mx-auto max-w-[1080px] px-5 md:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="h-4 w-px bg-white/10" />
              <span className="text-[11px] font-medium text-zinc-500">
                Feito para quem vive na pista. Uber, 99, iFood, Rappi.
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-semibold text-zinc-500">
              <Link href="/entrar" className="hover:text-zinc-300">
                Entrar
              </Link>
              <Link href="/criar-conta" className="hover:text-zinc-300">
                Criar conta
              </Link>
              <span className="flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-volt-400" /> R$19,90 vitalício
              </span>
            </div>
          </div>
          <p className="mt-6 text-[10.5px] leading-relaxed text-zinc-600">
            GiroLucro não tem vínculo com Uber, 99, iFood ou Rappi. É uma ferramenta independente para motoristas e
            motoboys calcularem lucro real. Valores da Batalha são baseados nos seus registros pessoais.
          </p>
        </div>
      </footer>
    </div>
  );
}
