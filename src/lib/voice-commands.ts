/**
 * Parser de comandos de voz em pt-BR para o GiroLucro.
 * Exemplos:
 *  - "ganho ifood 50 reais 8 entregas 3 horas 42 km"
 *  - "combustível 40 reais"
 *  - "marmita 15"
 *  - "salvar"
 *  - "uber 30 reais 2 horas 25 km"
 */

export type VoiceTab =
  | "ganho"
  | "combustivel"
  | "alimentacao"
  | "borracharia"
  | "equipamento"
  | "outro";

export type VoiceCommandResult = {
  tab?: VoiceTab;
  platform?: string;
  period?: string;
  amount?: number;
  hours?: number;
  km?: number;
  quantity?: number;
  waitMinutes?: number;
  settled?: boolean;
  note?: string;
  action?: "save" | "clear" | "cancel";
  raw: string;
  summary: string;
};

const PLATFORM_ALIASES: Record<string, string> = {
  uber: "uber",
  "99": "99",
  noventaenove: "99",
  "noventa e nove": "99",
  ifood: "ifood",
  "i food": "ifood",
  "ai food": "ifood",
  rappi: "rappi",
  rapi: "rappi",
  direto: "direto",
  particular: "direto",
  outro: "outro",
  outros: "outro",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Aliases extras gerados a partir dos apps do usuário (custom). */
export function buildPlatformAliases(
  platforms?: { id: string; label: string }[] | null,
): Record<string, string> {
  const map = { ...PLATFORM_ALIASES };
  if (!platforms) return map;
  for (const p of platforms) {
    if (!p?.id || !p?.label) continue;
    const norm = normalize(p.label);
    if (norm.length >= 2) map[norm] = p.id;
    const idNorm = normalize(p.id.replace(/^custom_/, "").replace(/_/g, " "));
    if (idNorm.length >= 2) map[idNorm] = p.id;
  }
  return map;
}

const TAB_ALIASES: Record<string, VoiceTab> = {
  ganho: "ganho",
  giro: "ganho",
  giros: "ganho",
  corrida: "ganho",
  corridas: "ganho",
  entrega: "ganho",
  entregas: "ganho",
  bateria: "ganho",
  receita: "ganho",
  faturamento: "ganho",
  combustivel: "combustivel",
  "combustível": "combustivel",
  gasolina: "combustivel",
  etanol: "combustivel",
  abastecimento: "combustivel",
  abastecer: "combustivel",
  marmita: "alimentacao",
  alimentacao: "alimentacao",
  "alimentação": "alimentacao",
  comida: "alimentacao",
  lanche: "alimentacao",
  almoco: "alimentacao",
  "almoço": "alimentacao",
  borracha: "borracharia",
  borracharia: "borracharia",
  pneu: "borracharia",
  furo: "borracharia",
  socorro: "borracharia",
  equipo: "equipamento",
  equipamento: "equipamento",
  mochila: "equipamento",
  suporte: "equipamento",
  outro: "outro",
  outros: "outro",
  pedágio: "outro",
  pedagio: "outro",
  estacionamento: "outro",
};

const PERIOD_ALIASES: Record<string, string> = {
  manha: "manha",
  "manhã": "manha",
  tarde: "tarde",
  noite: "noite",
  madrugada: "madrugada",
};

function parseNumberToken(raw: string): number | null {
  const cleaned = raw
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extrai número ligado a uma unidade.
 * Aceita "3 horas", "horas 3", "42 km", "km 42".
 * Keywords curtas (1–2 chars) só batem como palavra inteira.
 */
function numberNear(text: string, keywords: string[]): number | null {
  for (const key of keywords) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // número ANTES da unidade: "3 horas", "42 km", "8 entregas"
    const before = new RegExp(
      `([\\d]+(?:[.,]\\d+)?)\\s*${escaped}\\b`,
      "i",
    );
    const m1 = text.match(before);
    if (m1?.[1]) {
      const n = parseNumberToken(m1[1]);
      if (n !== null) return n;
    }
    // número DEPOIS da unidade: "horas 3", "km 42"
    const after = new RegExp(
      `\\b${escaped}\\s*(?:de\\s+|da\\s+|do\\s+)?([\\d]+(?:[.,]\\d+)?)`,
      "i",
    );
    const m2 = text.match(after);
    if (m2?.[1]) {
      const n = parseNumberToken(m2[1]);
      if (n !== null) return n;
    }
  }
  return null;
}

/** Extrai valor monetário: "50 reais", "r$ 30", "trinta reais", ou primeiro número solto. */
function extractMoney(text: string): number | null {
  const patterns = [
    /(?:r\$|rs)\s*([\d]+(?:[.,]\d+)?)/i,
    /([\d]+(?:[.,]\d+)?)\s*(?:reais|real|pila|conto|bagarai)/i,
    /(?:valor|ganhei|recebi|gastei|paguei|custa|custou)\s*(?:de\s+)?([\d]+(?:[.,]\d+)?)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const n = parseNumberToken(m[1]);
      if (n !== null) return n;
    }
  }
  return null;
}

function firstLooseNumber(text: string): number | null {
  const m = text.match(/(?:^|\s)([\d]+(?:[.,]\d+)?)(?:\s|$)/);
  if (!m?.[1]) return null;
  return parseNumberToken(m[1]);
}

function detectPlatform(
  text: string,
  extraAliases?: Record<string, string>,
): string | undefined {
  const aliases = extraAliases ?? PLATFORM_ALIASES;
  // Ordena aliases longos primeiro para "noventa e nove" etc.
  const entries = Object.entries(aliases).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [alias, id] of entries) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, "i");
    if (re.test(text)) return id;
  }
  return undefined;
}

function detectTab(text: string): VoiceTab | undefined {
  const entries = Object.entries(TAB_ALIASES).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [alias, id] of entries) {
    const re = new RegExp(`(?:^|\\s)${alias}(?:\\s|$)`, "i");
    if (re.test(text)) return id;
  }
  return undefined;
}

function detectPeriod(text: string): string | undefined {
  for (const [alias, id] of Object.entries(PERIOD_ALIASES)) {
    const re = new RegExp(`(?:^|\\s)${alias}(?:\\s|$)`, "i");
    if (re.test(text)) return id;
  }
  return undefined;
}

function detectAction(text: string): VoiceCommandResult["action"] | undefined {
  if (/\b(salvar|salva|confirma|confirmar|registrar|registre|pronto|ok)\b/.test(text)) {
    return "save";
  }
  if (/\b(limpar|limpa|apagar|apaga|zerar|zera)\b/.test(text)) {
    return "clear";
  }
  if (/\b(cancelar|cancela|desistir|parar)\b/.test(text)) {
    return "cancel";
  }
  return undefined;
}

function formatSummary(result: Omit<VoiceCommandResult, "raw" | "summary">): string {
  const bits: string[] = [];
  if (result.action === "save") bits.push("salvar");
  if (result.action === "clear") bits.push("limpar");
  if (result.action === "cancel") bits.push("cancelar");
  if (result.tab && result.tab !== "ganho") bits.push(result.tab);
  if (result.platform) bits.push(result.platform);
  if (result.amount != null) bits.push(`R$ ${String(result.amount).replace(".", ",")}`);
  if (result.quantity != null) bits.push(`${result.quantity} un.`);
  if (result.hours != null) bits.push(`${String(result.hours).replace(".", ",")}h`);
  if (result.km != null) bits.push(`${String(result.km).replace(".", ",")} km`);
  if (result.waitMinutes != null) bits.push(`${result.waitMinutes} min espera`);
  if (result.period) bits.push(result.period);
  if (result.settled === true) bits.push("já recebido");
  if (result.settled === false) bits.push("a receber");
  if (result.note) bits.push(`"${result.note}"`);
  return bits.length > 0 ? bits.join(" · ") : "comando reconhecido";
}

export function parseVoiceCommand(
  transcript: string,
  userPlatforms?: { id: string; label: string }[] | null,
): VoiceCommandResult {
  const raw = transcript.trim();
  const text = normalize(raw);

  const aliases = buildPlatformAliases(userPlatforms);
  const action = detectAction(text);
  const platform = detectPlatform(text, aliases);
  let tab = detectTab(text);
  const period = detectPeriod(text);

  // Se falou de plataforma, assume ganho
  if (!tab && platform) tab = "ganho";

  const hours = numberNear(text, [
    "horas",
    "hora",
    "hrs",
    "hr",
    "tempo online",
  ]);
  const km = numberNear(text, ["quilometros", "quilometro", "kms", "km"]);
  const quantity = numberNear(text, [
    "entregas",
    "entrega",
    "corridas",
    "corrida",
    "giros",
    "giro",
    "pedidos",
    "pedido",
    "unidades",
    "unidade",
  ]);
  const waitMinutes = numberNear(text, [
    "minutos de espera",
    "minuto de espera",
    "min de espera",
    "minutos",
    "minuto",
    "espera",
  ]);

  let amount = extractMoney(text);
  // Gasto/ganho sem unidade: pega o primeiro número se não houver amount
  if (amount == null && (tab || platform || action === "save")) {
    // evita capturar números já usados como km/h
    const stripped = text
      .replace(/[\d]+(?:[.,]\d+)?\s*(?:hora|horas|hr|hrs|h|quilometro|quilometros|km|entrega|entregas|corrida|corridas|giro|giros|pedido|pedidos|minuto|minutos|min)\b/gi, " ")
      .replace(/\b(?:hora|horas|hr|hrs|h|quilometro|quilometros|km|entrega|entregas|corrida|corridas)\s*[\d]+(?:[.,]\d+)?/gi, " ");
    amount = extractMoney(stripped) ?? firstLooseNumber(stripped);
  }

  let settled: boolean | undefined;
  if (/\b(ja recebi|ja recebido|pix|na hora|recebido|pago na hora)\b/.test(text)) {
    settled = true;
  } else if (/\b(a receber|repasse|fica a receber|ainda nao recebi)\b/.test(text)) {
    settled = false;
  }

  // Nota livre para gastos (após remover números e keywords)
  let note: string | undefined;
  if (tab && tab !== "ganho" && tab !== "combustivel") {
    const noteMatch = raw.match(
      /(?:descri[cç][aã]o|nota|obs|observa[cç][aã]o)[:\s]+(.+)$/i,
    );
    if (noteMatch?.[1]) note = noteMatch[1].trim().slice(0, 60);
  }

  // Se só falou "salvar" sem dados, action basta
  const result: Omit<VoiceCommandResult, "raw" | "summary"> = {
    tab,
    platform,
    period,
    amount: amount ?? undefined,
    hours: hours ?? undefined,
    km: km ?? undefined,
    quantity: quantity != null ? Math.max(1, Math.round(quantity)) : undefined,
    waitMinutes: waitMinutes ?? undefined,
    settled,
    note,
    action,
  };

  return {
    ...result,
    raw,
    summary: formatSummary(result),
  };
}

export function brlVoice(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

/** Checa suporte a reconhecimento de voz no browser. */
export function supportsSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: Event & { error?: string }) => void) | null;
  onresult: ((ev: SpeechRecognitionResultEventLike) => void) | null;
};

export type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      length: number;
      [index: number]: { transcript: string; confidence: number };
    };
  };
};

export function createSpeechRecognition(): BrowserSpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "pt-BR";
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  return rec;
}
