export interface Plan {
  id: "lifetime";
  label: string;
  price: number;
  days: number;
  tagline: string;
  highlight?: boolean;
}

/**
 * Nome técnico do período do plano: `lifetime` continua sendo o identificador
 * gravado no banco (compatibilidade com assinaturas legadas) e significa
 * "pagamento único, sem recorrência".
 */
export const LIFETIME_DAYS = 36500; // ~100 anos — na prática, sem data de expiração

/**
 * Terminologia única do produto (landing page, checkout, Mercado Pago,
 * Termos de Uso e recibo precisam dizer exatamente a mesma coisa):
 *   • "Pagamento único"          → como a compra é cobrada;
 *   • "Sem mensalidade"          → o que não existe;
 *   • "Sem renovação automática" → o que não existe;
 *   • acesso por tempo indeterminado enquanto o serviço existir.
 *
 * Evitamos "vitalício" por ser uma promessa maior do que o contrato define.
 */
export const PRO_PRODUCT_NAME = "GiroLucro Pro — pagamento único";
export const PRO_PRODUCT_DESCRIPTION =
  "Acesso por tempo indeterminado · sem mensalidade · sem renovação automática";
export const PRO_PRICE_LABEL = "R$ 19,90";
export const PRO_PAYMENT_LINES = [
  "Pagamento único",
  "Sem mensalidade",
  "Sem renovação automática",
] as const;

export const PLANS: Plan[] = [
  {
    id: "lifetime",
    label: "Pagamento único",
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
  return "pagamento único";
}
