/**
 * Consentimento de cookies / tecnologias de medição.
 *
 * Regra do GiroLucro:
 *  - cookies **necessários** (login, segurança, tema, este próprio aceite)
 *    funcionam sempre — sem eles o app não funciona;
 *  - tecnologia de **analytics** (o identificador `gl_vid` e o registro de
 *    visitas) só é ativada depois de uma escolha explícita do visitante.
 *
 * A preferência fica no cookie de primeiro domínio `gl_consent`, legível pelo
 * navegador (o VisitTracker precisa dela antes de criar `gl_vid`).
 */

export const CONSENT_COOKIE = "gl_consent";
export const CONSENT_MAX_AGE_DAYS = 180; // revalida a escolha 2x por ano

/** Evento disparado quando a escolha muda (o app escuta para ligar/desligar). */
export const CONSENT_EVENT = "girolucro:consent-change";

/** Evento para abrir o painel de preferências de qualquer lugar do app. */
export const OPEN_PREFERENCES_EVENT = "girolucro:open-cookie-preferences";

/** Abre o painel de preferências de cookies (rodapé, configurações, etc.). */
export function openCookiePreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
}

export type ConsentValue = "necessary" | "analytics";

export const CONSENT_LABELS: Record<ConsentValue, string> = {
  necessary: "Somente necessários",
  analytics: "Aceitar analytics",
};

export const COOKIE_CONSENT_TEXT =
  "Usamos tecnologias necessárias ao funcionamento do GiroLucro e, com sua permissão, dados de navegação para entendermos como o aplicativo é utilizado.";

/* ------------------------------- leitura ---------------------------------- */

/** Lê a preferência salva no navegador (null = ainda não escolheu). */
export function readConsent(): ConsentValue | null {
  if (typeof document === "undefined") return null;
  const match = new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=([^;]*)`).exec(document.cookie);
  const value = match?.[1] ? decodeURIComponent(match[1]) : "";
  return value === "analytics" || value === "necessary" ? value : null;
}

/** `true` apenas quando o visitante autorizou medição. */
export function hasAnalyticsConsent(): boolean {
  return readConsent() === "analytics";
}

/** Opt-out histórico do próprio app (`gl_analytics_off`) — continua valendo. */
export function isAnalyticsOptedOut(): boolean {
  if (process.env.NEXT_PUBLIC_ANALYTICS === "off") return true;
  try {
    return localStorage.getItem("gl_analytics_off") === "1";
  } catch {
    return false;
  }
}

/** Regra final usada pelo medidor de visitas no navegador. */
export function analyticsAllowed(): boolean {
  return hasAnalyticsConsent() && !isAnalyticsOptedOut();
}

/* ------------------------------ gravação ---------------------------------- */

export function writeConsent(value: ConsentValue) {
  if (typeof document === "undefined") return;
  const maxAge = CONSENT_MAX_AGE_DAYS * 86400;
  // `Secure` fora de localhost: a escolha trafega sempre em HTTPS em produção.
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
  try {
    localStorage.setItem(CONSENT_COOKIE, value);
  } catch {
    /* modo privado: o cookie ainda funciona */
  }
  window.dispatchEvent(new CustomEvent<ConsentValue>(CONSENT_EVENT, { detail: value }));
}

/**
 * Limpa identificadores de medição já criados quando a pessoa escolhe
 * "Somente necessários" (direito de revogação — LGPD art. 8º §5º).
 */
export function clearAnalyticsIdentifiers() {
  if (typeof document === "undefined") return;
  document.cookie = "gl_vid=; path=/; max-age=0; SameSite=Lax";
  try {
    localStorage.removeItem("gl_vid");
    sessionStorage.removeItem("gl_sid");
  } catch {
    /* sem storage disponível */
  }
}

/** Aplica a escolha do visitante, limpando o que não faz mais sentido manter. */
export function applyConsent(value: ConsentValue) {
  writeConsent(value);
  if (value === "necessary") clearAnalyticsIdentifiers();
}
