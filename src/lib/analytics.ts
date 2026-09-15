/**
 * Coleta de visitas — utilidades puras (sem Next, sem banco).
 *
 * Tudo aqui roda tanto no edge quanto no node e é testável isoladamente:
 * só classifica o que chegou (user-agent, referer, utm) em colunas
 * agregáveis para o painel em /admin.
 */

/** Fuso usado nos "dias" do painel (o dono do app está no Brasil). */
export const ANALYTICS_TZ = "America/Sao_Paulo";

/** Quantos ms sem interação já contam como "saltou" (bounce). */
export const BOUNCE_DWELL_MS = 15_000;

/** Cookies de primeiro domínio usados pela medição. */
export const VISITOR_COOKIE = "gl_vid";

/**
 * Páginas que não interessam para o painel (assets, API, arquivos do PWA).
 * Comparado com o pathname, sem query string.
 */
const IGNORED_PATHS = new Set([
  "/api",
  "/favicon.ico",
  "/robots.txt",
  "/manifest.webmanifest",
  "/sw.js",
  "/icons/icon-512.png",
]);

const IGNORED_PREFIXES = [
  "/api/",
  "/_next/",
  "/icons/",
  "/images/",
  "/_vercel/",
  "/sweep/",
];

export function shouldTrackPath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.length > 200) return false;
  if (IGNORED_PATHS.has(pathname)) return false;
  if (IGNORED_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  // arquivos estáticos (favicon.png, app.js, styles.css...)
  if (/\.(?:ico|png|jpe?g|webp|svg|css|js|ts|map|txt|xml|webmanifest|woff2?)$/i.test(pathname)) {
    return false;
  }
  return true;
}

/** Nome amigável das páginas no painel (agrega /assinatura/sucesso etc.). */
const PAGE_LABELS: Record<string, string> = {
  "/": "Início / Landing",
  "/landing": "Landing (Batalha dos Apps)",
  "/sobre": "Sobre",
  "/bem-vindo": "Boas-vindas",
  "/criar-conta": "Cadastro",
  "/registrar": "Cadastro (antigo)",
  "/entrar": "Login",
  "/esqueci-senha": "Recuperar senha",
  "/redefinir-senha": "Redefinir senha",
  "/assinatura": "Assinatura / paywall",
  "/assinatura/sucesso": "Pagamento aprovado",
  "/comparar": "Batalha dos Apps",
  "/manutencao": "Oficina",
  "/metas": "Metas",
  "/configuracoes": "Configurações",
  "/contato": "Contato",
  "/admin": "Painel admin",
};

export function pageLabel(path: string): string {
  if (PAGE_LABELS[path]) return PAGE_LABELS[path];
  const clean = path.replace(/^\//, "").replace(/\/$/, "");
  if (!clean) return "Início";
  return `/${clean}`;
}

/** Normaliza o path: remove query/hash, caracteres estranhos e limita o tamanho. */
export function sanitizePath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = String(raw).trim();
  if (!value.startsWith("/")) {
    // o cliente pode mandar location.href inteiro
    try {
      value = new URL(value).pathname;
    } catch {
      return null;
    }
  }
  value = value.split("?")[0].split("#")[0];
  if (!value.startsWith("/")) return null;
  // só caracteres de URL segura — evita lixo/SQLi via path
  if (!/^[\w\-./]{1,200}$/.test(value)) return null;
  const trimmed = value.replace(/\/{2,}/g, "/").replace(/(.)\/$/, "$1");
  return trimmed === "" ? "/" : trimmed;
}

/* --------------------------------- bots ----------------------------------- */

const BOT_PATTERN =
  /(?:bot|crawl|spider|slurp|lighthouse|headless|phantom|selenium|puppeteer|playwright|curl|wget|python|aiohttp|httpx|go-http-client|java\/|okhttp|libwww|node-fetch|undici|axios|fez|fetch|wget|scrapy|postman|insomnia|monitor|pingdom|uptime|sentry|prerender|preview|whatsapp|telegram|discord|slack|teams|skype|facebookexternalhit|facebot|twitterbot|linkedinbot|instagram\b.*bot|googleplus|pinterest|reddit|tumblr|snapchat|bingpreview|chrome\-lighthouse|semrush|ahrefs|majestic|dotbot|petalbot|bytespider|compatible;\s*[^;]*bot)/i;

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // sem UA = script/robot
  return BOT_PATTERN.test(userAgent);
}

/* ------------------------------ user agent --------------------------------- */

export type DeviceType = "mobile" | "tablet" | "desktop";

export function parseUserAgent(uaRaw: string | null | undefined): {
  device: DeviceType;
  browser: string;
  os: string;
} {
  const ua = uaRaw ?? "";
  let device: DeviceType = "desktop";
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))|kindle|nexus 7/i.test(ua)) device = "tablet";
  else if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/i.test(ua))
    device = "mobile";

  let browser = "Outro";
  if (/edg[ei]?(?:a|ios)?\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/samsungbrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/crios/i.test(ua)) browser = "Chrome";
  else if (/chrome|chromium|brave|vivaldi/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua)) browser = "Safari";
  else if (/electron|node|python|curl|wget/i.test(ua)) browser = "Robô/App";

  let os = "Outro";
  if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/windows nt 10/i.test(ua)) os = "Windows 10/11";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/cros/i.test(ua)) os = "ChromeOS";
  else if (/linux/i.test(ua)) os = "Linux";

  return { device, browser, os };
}

/* ------------------------------- origens ---------------------------------- */

export const CHANNELS = ["direto", "busca", "social", "anuncio", "email", "referencia", "interno"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  direto: "Acesso direto",
  busca: "Busca orgânica",
  social: "Redes sociais",
  anuncio: "Anúncios",
  email: "E-mail",
  referencia: "Indicação / link",
  interno: "Dentro do app",
};

const SEARCH_HOSTS = [
  "google.",
  "bing.",
  "duckduckgo.",
  "search.yahoo.",
  "yahoo.",
  "ecosia.",
  "baidu.",
  "yandex.",
  "startpage.",
  "brave.",
];

const SOCIAL_HOSTS = [
  "facebook.",
  "m.facebook.",
  "instagram.",
  "t.co",
  "twitter.",
  "x.com",
  "linkedin.",
  "tiktok.",
  "wa.me",
  "whatsapp.",
  "youtube.",
  "youtu.be",
  "reddit.",
  "pinterest.",
  "threads.",
  "telegram.",
  "t.me",
  "snackvideo.",
  "kwai.",
  "facebook.com",
];

const PAID_MEDIUMS = ["cpc", "ppc", "paid", "display", "ads", "ad", "paid_social", "paidsearch", "paid-search", "video", "shopping"];
const SOCIAL_MEDIUMS = ["social", "social-network", "social-media", "sms", "community", "chat", "messaging"];

/** Domínio "registrável" aproximado: google.com.br → google.com.br, m.google.com → google.com */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return null;
    const parts = host.split(".");
    if (parts.length <= 2) return host;
    // mantém sufixos compostos comuns no Brasil (.com.br, .net.br...)
    const isCompositeTld = /^(com|net|org|gob|edu|jus|fm|tur|apo|srv|eng)\.br$/i.test(parts.slice(-2).join("."));
    return isCompositeTld ? parts.slice(-3).join(".") : parts.slice(-2).join(".");
  } catch {
    return null;
  }
}

export type TrafficOrigin = {
  referrer: string | null;
  referrerDomain: string | null;
  channel: Channel;
  source: string | null;
  medium: string | null;
  campaign: string | null;
};

/**
 * Classifica a origem do tráfego. `selfHost` é o host do próprio app —
 * navegação entre páginas dele conta como "interno".
 */
export function classifyTraffic(params: {
  referrer?: string | null;
  search?: string | null;
  selfHost?: string | null;
}): TrafficOrigin {
  const host = (params.selfHost ?? "").toLowerCase().replace(/^www\./, "");

  // utm_* têm prioridade sobre o referer
  let source: string | null = null;
  let medium: string | null = null;
  let campaign: string | null = null;
  if (params.search) {
    try {
      const q = new URLSearchParams(params.search.startsWith("?") ? params.search.slice(1) : params.search);
      source = clamp(q.get("utm_source"), 40);
      medium = clamp(q.get("utm_medium")?.toLowerCase(), 40);
      campaign = clamp(q.get("utm_campaign"), 60);
    } catch {
      /* ignora query malformada */
    }
  }

  const referrerDomain = referrerHost(params.referrer);
  const referrer = params.referrer
    ? String(params.referrer).slice(0, 300)
    : null;

  let channel: Channel = "direto";
  if (referrerDomain && host && referrerDomain === host.split(".").slice(-2).join(".")) {
    channel = "interno";
  } else if (referrerDomain && referrerDomain === host) {
    channel = "interno";
  } else if (referrerDomain) {
    if (SEARCH_HOSTS.some((s) => referrerDomain.includes(s))) channel = "busca";
    else if (SOCIAL_HOSTS.some((s) => referrerDomain.includes(s))) channel = "social";
    else channel = "referencia";
  }

  if (medium) {
    if (PAID_MEDIUMS.includes(medium)) channel = "anuncio";
    else if (SOCIAL_MEDIUMS.includes(medium)) channel = "social";
    else if (medium === "email" || medium === "newsletter") channel = "email";
    else if (medium === "organic" || medium === "search" || medium === "cse") channel = "busca";
    else if (medium === "referral" || medium === "link" || medium === "url") channel = "referencia";
  }

  if (!source && channel === "referencia" && referrerDomain) source = referrerDomain;
  if (!source && channel === "busca") source = referrerDomain ?? "google";
  if (!source && channel === "social") source = referrerDomain;

  return {
    referrer,
    referrerDomain,
    channel,
    source: clamp(source, 40),
    medium: clamp(medium, 40),
    campaign: clamp(campaign, 60),
  };
}

function clamp(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.slice(0, max);
}

/* --------------------------------- dias ----------------------------------- */

const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: ANALYTICS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** yyyy-MM-dd no fuso de São Paulo (mesmo formato usado em work_entries.date). */
export function dayKey(date: Date = new Date()): string {
  return DAY_FMT.format(date);
}

/** Lista de dias (mais antigo → hoje), inclusive. */
export function dayRange(days: number, end: Date = new Date()): string[] {
  const n = Math.max(1, Math.min(365, Math.round(days)));
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(dayKey(new Date(end.getTime() - i * 86400000)));
  }
  return out;
}

/** Rótulo curto de dia para os gráficos: 12/09. */
export function dayLabel(day: string): string {
  const [, m, d] = day.split("-");
  return d ? `${d}/${m}` : day;
}

/** Dia da semana (0=dom) a partir de yyyy-MM-dd, sem depender de fuso. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return 0;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Limita a janela pedida na URL (7 | 30 | 90). */
export function resolveRangeDays(raw: string | null | undefined): number {
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return 30;
  return Math.max(3, Math.min(180, n));
}
