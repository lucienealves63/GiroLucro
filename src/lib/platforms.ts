/**
 * Plataformas de ganho (apps) — padrão + personalizadas por usuário.
 * Persistidas em settings.platforms_json como JSON.
 */

export type PlatformCategory = "ride" | "delivery";

export type PlatformMeta = {
  id: string;
  label: string;
  color: string;
  soft: string;
  initials: string;
  category: PlatformCategory;
  unit: string; // corrida | entrega
  /** true = criada pelo usuário */
  custom?: boolean;
  /** se false, some da tela de registrar (histórico continua ok) */
  enabled?: boolean;
};

export type PlatformCategoryOption = {
  id: PlatformCategory;
  label: string;
  unit: string;
};

export const PLATFORM_CATEGORIES: PlatformCategoryOption[] = [
  { id: "ride", label: "Corrida / passageiro", unit: "corrida" },
  { id: "delivery", label: "Entrega / delivery", unit: "entrega" },
];

/** Paleta para apps customizados (rodízio). */
export const CUSTOM_COLORS = [
  "#38BDF8", // sky
  "#A78BFA", // violet
  "#F472B6", // pink
  "#FB923C", // orange
  "#2DD4BF", // teal
  "#FACC15", // yellow
  "#4ADE80", // green
  "#F87171", // red
  "#818CF8", // indigo
  "#E879F9", // fuchsia
];

export const BUILTIN_PLATFORMS: PlatformMeta[] = [
  {
    id: "uber",
    label: "Uber",
    color: "#E8E8E8",
    soft: "rgba(232,232,232,0.14)",
    initials: "U",
    category: "ride",
    unit: "corrida",
  },
  {
    id: "99",
    label: "99",
    color: "#FFD300",
    soft: "rgba(255,211,0,0.14)",
    initials: "99",
    category: "ride",
    unit: "corrida",
  },
  {
    id: "ifood",
    label: "iFood",
    color: "#EA1D2C",
    soft: "rgba(234,29,44,0.16)",
    initials: "iF",
    category: "delivery",
    unit: "entrega",
  },
  {
    id: "rappi",
    label: "Rappi",
    color: "#FF441F",
    soft: "rgba(255,68,31,0.15)",
    initials: "R",
    category: "delivery",
    unit: "entrega",
  },
  {
    id: "direto",
    label: "Direto",
    color: "#34D399",
    soft: "rgba(52,211,153,0.14)",
    initials: "D",
    category: "delivery",
    unit: "entrega",
  },
  {
    id: "outro",
    label: "Outros",
    color: "#7DD3FC",
    soft: "rgba(125,211,252,0.14)",
    initials: "•",
    category: "ride",
    unit: "corrida",
  },
];

export const BUILTIN_IDS = new Set(BUILTIN_PLATFORMS.map((p) => p.id));

const BUILTIN_MAP: Record<string, PlatformMeta> = Object.fromEntries(
  BUILTIN_PLATFORMS.map((p) => [p.id, p]),
);

export function softFromColor(hex: string): string {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6 && h.length !== 3) return "rgba(125,211,252,0.14)";
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return "rgba(125,211,252,0.14)";
  return `rgba(${r},${g},${b},0.16)`;
}

export function initialsFromLabel(label: string): string {
  const clean = label.trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return clean.slice(0, 2).toUpperCase();
}

/** Gera id estável a partir do nome (custom_xxx). */
export function slugifyPlatform(label: string): string {
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
  const core = base || "app";
  // evita colidir com built-ins
  if (BUILTIN_IDS.has(core)) return `custom_${core}`;
  return core.startsWith("custom_") ? core : `custom_${core}`;
}

export function defaultPlatformsList(): PlatformMeta[] {
  return BUILTIN_PLATFORMS.map((p) => ({ ...p, enabled: true, custom: false }));
}

type StoredPlatform = {
  id: string;
  enabled?: boolean;
  label?: string;
  color?: string;
  category?: PlatformCategory;
  unit?: string;
  custom?: boolean;
};

/**
 * Lê o JSON salvo e devolve a lista completa (built-ins + custom).
 * Built-ins ausentes no JSON entram habilitados (compatibilidade).
 */
export function parsePlatformsJson(raw: string | null | undefined): PlatformMeta[] {
  let stored: StoredPlatform[] = [];
  if (raw && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) stored = parsed as StoredPlatform[];
    } catch {
      stored = [];
    }
  }

  if (stored.length === 0) return defaultPlatformsList();

  const byId = new Map<string, StoredPlatform>();
  for (const item of stored) {
    if (item && typeof item.id === "string" && item.id.trim()) {
      byId.set(item.id.trim(), item);
    }
  }

  const result: PlatformMeta[] = [];

  // 1) built-ins na ordem padrão
  for (const b of BUILTIN_PLATFORMS) {
    const s = byId.get(b.id);
    result.push({
      ...b,
      custom: false,
      enabled: s ? s.enabled !== false : true,
    });
    byId.delete(b.id);
  }

  // 2) customizadas na ordem em que foram salvas
  for (const item of stored) {
    if (!item?.id || BUILTIN_IDS.has(item.id)) continue;
    const label = String(item.label ?? item.id).trim().slice(0, 40) || "App";
    const color =
      typeof item.color === "string" && /^#?[0-9a-fA-F]{3,8}$/.test(item.color)
        ? item.color.startsWith("#")
          ? item.color
          : `#${item.color}`
        : CUSTOM_COLORS[result.length % CUSTOM_COLORS.length];
    const category: PlatformCategory =
      item.category === "delivery" || item.category === "ride"
        ? item.category
        : "delivery";
    const unit =
      typeof item.unit === "string" && item.unit.trim()
        ? item.unit.trim().slice(0, 20)
        : category === "delivery"
          ? "entrega"
          : "corrida";
    result.push({
      id: item.id.slice(0, 40),
      label,
      color,
      soft: softFromColor(color),
      initials: initialsFromLabel(label),
      category,
      unit,
      custom: true,
      enabled: item.enabled !== false,
    });
  }

  return result;
}

export function serializePlatforms(list: PlatformMeta[]): string {
  const payload: StoredPlatform[] = list.map((p) => {
    if (p.custom) {
      return {
        id: p.id,
        label: p.label,
        color: p.color,
        category: p.category,
        unit: p.unit,
        custom: true,
        enabled: p.enabled !== false,
      };
    }
    return { id: p.id, enabled: p.enabled !== false };
  });
  return JSON.stringify(payload);
}

/** Apenas as que aparecem no seletor de registro. */
export function enabledPlatforms(list: PlatformMeta[]): PlatformMeta[] {
  const enabled = list.filter((p) => p.enabled !== false);
  return enabled.length > 0 ? enabled : defaultPlatformsList();
}

/** Mapa id → meta (inclui desabilitadas, para histórico). */
export function platformsMap(list: PlatformMeta[]): Record<string, PlatformMeta> {
  const map: Record<string, PlatformMeta> = { ...BUILTIN_MAP };
  for (const p of list) {
    map[p.id] = p;
  }
  return map;
}

/**
 * Resolve meta de qualquer id (histórico ou ativo).
 * Custom desconhecida cai em "outro" com o id como label.
 */
export function resolvePlatformMeta(
  id: string,
  list?: PlatformMeta[] | null,
): PlatformMeta {
  if (list) {
    const found = list.find((p) => p.id === id);
    if (found) return found;
  }
  if (BUILTIN_MAP[id]) return BUILTIN_MAP[id];
  // id custom sem estar na lista (removido depois do lançamento)
  const label = id.startsWith("custom_")
    ? id.replace(/^custom_/, "").replace(/_/g, " ")
    : id;
  const pretty = label.charAt(0).toUpperCase() + label.slice(1);
  return {
    id,
    label: pretty || "App",
    color: "#7DD3FC",
    soft: "rgba(125,211,252,0.14)",
    initials: initialsFromLabel(pretty || "App"),
    category: "delivery",
    unit: "entrega",
    custom: true,
    enabled: false,
  };
}

export function platformName(id: string, list?: PlatformMeta[] | null): string {
  return resolvePlatformMeta(id, list).label;
}

/** Valida se o id pode ser usado num lançamento (built-in, custom na lista, ou custom_*). */
export function isValidPlatformId(
  id: string,
  list?: PlatformMeta[] | null,
): boolean {
  if (!id || id.length > 40) return false;
  if (BUILTIN_IDS.has(id)) return true;
  if (list?.some((p) => p.id === id)) return true;
  // aceita custom_xxx para não bloquear race de sync
  return /^custom_[a-z0-9_]{1,32}$/i.test(id);
}

export function nextCustomColor(list: PlatformMeta[]): string {
  const used = new Set(list.map((p) => p.color.toLowerCase()));
  const free = CUSTOM_COLORS.find((c) => !used.has(c.toLowerCase()));
  return free ?? CUSTOM_COLORS[list.length % CUSTOM_COLORS.length];
}

/** Garante id único ao adicionar. */
export function uniquePlatformId(label: string, existing: PlatformMeta[]): string {
  let id = slugifyPlatform(label);
  const ids = new Set(existing.map((p) => p.id));
  if (!ids.has(id)) return id;
  let n = 2;
  while (ids.has(`${id}_${n}`) && n < 100) n++;
  return `${id}_${n}`;
}
