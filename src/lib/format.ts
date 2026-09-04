const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const BRL0 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const NUM2 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function brl(v: number, force0 = false): string {
  if (force0 && Math.abs(v) >= 1000) return BRL0.format(v);
  return BRL.format(v);
}

export function brlSign(v: number): string {
  const s = BRL.format(Math.abs(v));
  return v < 0 ? `− ${s}` : `+ ${s}`;
}

export function km(v: number): string {
  return `${NUM.format(v)} km`;
}

export function hrs(h: number): string {
  if (h <= 0) return "0h";
  const H = Math.floor(h);
  const M = Math.round((h - H) * 60);
  if (H === 0) return `${M}min`;
  return M > 0 ? `${H}h${String(M).padStart(2, "0")}` : `${H}h`;
}

export function num2(v: number): string {
  return NUM2.format(v);
}

export function parseBR(v: string): number {
  if (!v) return 0;
  const clean = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return Number.isFinite(n) ? n : 0;
}

export function todayStr(): string {
  return formatDateStr(new Date());
}

export function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return formatDateStr(d);
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const WEEKDAYS_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export function weekdayName(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return WEEKDAYS[d.getDay()];
}

export function weekdayShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return WEEKDAYS_SHORT[d.getDay()];
}

export function dayMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fullDate(dateStr: string): string {
  return `${weekdayName(dateStr)}, ${dayMonth(dateStr)}`;
}

export function timeAgo(dateStr: string, today: string): string {
  if (dateStr === today) return "Hoje";
  if (dateStr === addDaysStr(today, -1)) return "Ontem";
  return fullDate(dateStr);
}

export function last7Days(today: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysStr(today, i - 6));
}

export function lastNDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDaysStr(today, i - n + 1));
}

export function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export type PlatformCategory = "ride" | "delivery";

export const PLATFORM_META: Record<
  string,
  {
    label: string;
    color: string;
    soft: string;
    initials: string;
    category: PlatformCategory;
    unit: string; // corrida | entrega
  }
> = {
  uber: { label: "Uber", color: "#E8E8E8", soft: "rgba(232,232,232,0.14)", initials: "U", category: "ride", unit: "corrida" },
  "99": { label: "99", color: "#FFD300", soft: "rgba(255,211,0,0.14)", initials: "99", category: "ride", unit: "corrida" },
  ifood: { label: "iFood", color: "#EA1D2C", soft: "rgba(234,29,44,0.16)", initials: "iF", category: "delivery", unit: "entrega" },
  rappi: { label: "Rappi", color: "#FF441F", soft: "rgba(255,68,31,0.15)", initials: "R", category: "delivery", unit: "entrega" },
  direto: { label: "Direto", color: "#34D399", soft: "rgba(52,211,153,0.14)", initials: "D", category: "delivery", unit: "entrega" },
  outro: { label: "Outros", color: "#7DD3FC", soft: "rgba(125,211,252,0.14)", initials: "•", category: "ride", unit: "corrida" },
};

export const PLATFORM_KEYS = ["uber", "99", "ifood", "rappi", "direto", "outro"] as const;

export function platformName(p: string): string {
  return PLATFORM_META[p]?.label ?? "Outros";
}

export const EXPENSE_META: Record<string, { label: string }> = {
  combustivel: { label: "Combustível" },
  alimentacao: { label: "Alimentação" },
  borracharia: { label: "Borracharia / socorro" },
  equipamento: { label: "Equipamento" },
  manutencao: { label: "Manutenção" },
  outro: { label: "Outros" },
};

export const EMERGENCY_TYPES = ["borracharia", "equipamento"];

export const MAINT_META: Record<
  string,
  { label: string; defaultInterval: number; unit: string }
> = {
  oleo: { label: "Troca de óleo", defaultInterval: 1000, unit: "km" },
  freios: { label: "Pastilhas de freio", defaultInterval: 5000, unit: "km" },
  relacao: { label: "Relação / corrente", defaultInterval: 8000, unit: "km" },
  pneus: { label: "Pneus", defaultInterval: 12000, unit: "km" },
  revisao: { label: "Revisão geral", defaultInterval: 6000, unit: "km" },
  outro: { label: "Outro serviço", defaultInterval: 3000, unit: "km" },
};

export const PERIOD_META: Record<string, { label: string; emojiFree: string }> = {
  manha: { label: "Manhã", emojiFree: "06–12h" },
  tarde: { label: "Tarde", emojiFree: "12–18h" },
  noite: { label: "Noite", emojiFree: "18–00h" },
  madrugada: { label: "Madrugada", emojiFree: "00–06h" },
};
