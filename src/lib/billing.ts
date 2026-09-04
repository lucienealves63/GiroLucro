export interface Plan {
  id: "monthly" | "yearly";
  label: string;
  price: number;
  days: number;
  tagline: string;
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "monthly",
    label: "Mensal",
    price: 19.9,
    days: 30,
    tagline: "Flexibilidade total",
  },
  {
    id: "yearly",
    label: "Anual",
    price: 149.9,
    days: 365,
    tagline: "Equivale a R$ 12,49/mês · 2 meses grátis",
    highlight: true,
  },
];

export const PRO_FEATURES = [
  "Lucro real automático (combustível, manutenção, custos fixos)",
  "Comparativo Uber × 99 × iFood × Rappi × Direto",
  "Lucro por hora, por km e por entrega — com espera em loja",
  "Calculadora \u201cvale a pena aceitar?\u201d com sua média real",
  "Controle de repasses que os apps te devem",
  "Alertas de manutenção por quilômetro rodado",
  "Metas diárias, fundo de dias fracos e provisão de férias",
];
