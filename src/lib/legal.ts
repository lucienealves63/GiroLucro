/**
 * Versionamento dos documentos jurídicos e dados de contratação.
 *
 * Fonte única para: data de vigência, versão e rótulos usados nos aceites.
 * Ao alterar um documento de forma relevante, incremente a versão aqui
 * ("1.0" → "1.1" → "2.0"). Mudanças relevantes podem exigir novo aceite:
 * basta trocar a versão e o app passa a registrar o novo aceite (o histórico
 * fica em `legal_acceptances`).
 */

export type LegalDocumentId = "terms" | "privacy";

export interface LegalDocumentMeta {
  id: LegalDocumentId;
  title: string;
  version: string;
  /** Texto já formatado: "Versão 1.0 — setembro de 2026". */
  versionLabel: string;
  /** ISO date da entrada em vigor. */
  effectiveDate: string;
  effectiveLabel: string;
}

export const TERMS_VERSION = "1.0";
export const PRIVACY_VERSION = "1.0";
/** Versão da política específica de cookies (página /cookies). */
export const COOKIES_VERSION = "1.0";

export const TERMS_DOC: LegalDocumentMeta = {
  id: "terms",
  title: "Termos de Uso",
  version: TERMS_VERSION,
  versionLabel: `Versão ${TERMS_VERSION} — setembro de 2026`,
  effectiveDate: "2026-09-01",
  effectiveLabel: "1º de setembro de 2026",
};

export const PRIVACY_DOC: LegalDocumentMeta = {
  id: "privacy",
  title: "Política de Privacidade",
  version: PRIVACY_VERSION,
  versionLabel: `Versão ${PRIVACY_VERSION} — setembro de 2026`,
  effectiveDate: "2026-09-01",
  effectiveLabel: "1º de setembro de 2026",
};

export const COOKIES_DOC: LegalDocumentMeta = {
  id: "privacy",
  title: "Política de Cookies",
  version: COOKIES_VERSION,
  versionLabel: `Versão ${COOKIES_VERSION} — setembro de 2026`,
  effectiveDate: "2026-09-01",
  effectiveLabel: "1º de setembro de 2026",
};

export const LEGAL_DOCS: LegalDocumentMeta[] = [TERMS_DOC, PRIVACY_DOC];

/** Versão vigente por documento (usada nos aceites e nas gravações). */
export const CURRENT_VERSIONS: Record<LegalDocumentId, string> = {
  terms: TERMS_VERSION,
  privacy: PRIVACY_VERSION,
};

/** Prazo (em dias) para exercer o direito de arrependimento — CDC art. 49. */
export const REFUND_WINDOW_DAYS = 7;

/**
 * Situação do prazo de arrependimento em relação à data do pagamento.
 * `unknown` = não existe compra registrada na conta.
 */
export function refundWindowFor(
  paidAt: Date | string | null | undefined,
): "within" | "outside" | "unknown" {
  if (!paidAt) return "unknown";
  const date = typeof paidAt === "string" ? new Date(paidAt) : paidAt;
  if (!Number.isFinite(date.getTime())) return "unknown";
  const days = (Date.now() - date.getTime()) / 86_400_000;
  return days <= REFUND_WINDOW_DAYS ? "within" : "outside";
}

/** Prazo estimado de resposta a uma solicitação de titular (LGPD art. 19). */
export const DSAR_RESPONSE_DAYS = 15;

/** Formata a data/hora do aceite para exibição (fuso do Brasil). */
export function formatDateTimeBR(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
