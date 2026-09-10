export interface Plan {
  id: "lifetime";
  label: string;
  price: number;
  days: number;
  tagline: string;
  highlight?: boolean;
}

/** Pagamento único — libera o Pro por tempo indeterminado (lifetime). */
export const LIFETIME_DAYS = 36500; // ~100 anos

export const PLANS: Plan[] = [
  {
    id: "lifetime",
    label: "Vitalício",
    price: 19.9,
    days: LIFETIME_DAYS,
    tagline: "Pagamento único · acesso total sem mensalidade",
    highlight: true,
  },
];

/** Plano único usado em todo o app. */
export const DEFAULT_PLAN = PLANS[0];

export const PRO_FEATURES = [
  "Lucro real automático (combustível, manutenção, custos fixos)",
  "Comparativo Uber × 99 × iFood × Rappi × Direto",
  "Lucro por hora, por km e por entrega — com espera em loja",
  "Calculadora \u201cvale a pena aceitar?\u201d com sua média real",
  "Controle de repasses que os apps te devem",
  "Alertas de manutenção por quilômetro rodado",
  "Metas diárias, fundo de dias fracos e provisão de férias",
  "Comandos de voz para registrar giros e gastos",
];

/** Aceita ids legados (monthly/yearly) e o atual (lifetime). */
export type PlanCycleId = "lifetime" | "monthly" | "yearly";

export function resolvePlan(cycle?: string | null): Plan {
  if (cycle === "lifetime") return DEFAULT_PLAN;
  // Migração: planos antigos mensais/anuais ainda batem no preço único ao reativar
  return DEFAULT_PLAN;
}

export function planLabel(cycle?: string | null): string {
  if (cycle === "yearly") return "anual (legado)";
  if (cycle === "monthly") return "mensal (legado)";
  return "vitalício";
}
