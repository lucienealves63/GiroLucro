import { eq } from "drizzle-orm";
import { db } from "@/db";
import { legalAcceptances, users, type User } from "@/db/schema";
import { CURRENT_VERSIONS, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

/**
 * Aceite dos documentos jurídicos.
 *
 * Guardamos apenas: documento, versão, data/hora e origem (cadastro,
 * configurações, checkout). O texto completo do documento NÃO fica no registro
 * do usuário — ele é público em /termos e /privacidade, com versão explícita.
 */

export type AcceptanceSource = "signup" | "settings" | "checkout";

export type AcceptanceSnapshot = {
  termsVersion: string;
  termsAcceptedAt: Date | null;
  privacyVersion: string;
  privacyAcceptedAt: Date | null;
};

/** Grava o aceite do usuário (histórico + snapshot na linha do usuário). */
export async function recordLegalAcceptance(
  userId: number,
  source: AcceptanceSource,
  now: Date = new Date(),
): Promise<AcceptanceSnapshot> {
  await db.insert(legalAcceptances).values([
    {
      userId,
      documentType: "terms",
      documentVersion: TERMS_VERSION,
      acceptedAt: now,
      source,
    },
    {
      userId,
      documentType: "privacy",
      documentVersion: PRIVACY_VERSION,
      acceptedAt: now,
      source,
    },
  ]);

  await db
    .update(users)
    .set({
      termsAcceptedAt: now,
      termsVersion: TERMS_VERSION,
      privacyAcceptedAt: now,
      privacyVersion: PRIVACY_VERSION,
    })
    .where(eq(users.id, userId));

  return {
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: now,
    privacyVersion: PRIVACY_VERSION,
    privacyAcceptedAt: now,
  };
}

export type UserAcceptanceFields = Pick<
  User,
  "termsVersion" | "termsAcceptedAt" | "privacyVersion" | "privacyAcceptedAt"
>;

/** O usuário aceitou a versão vigente dos dois documentos? */
export function hasCurrentAcceptance(user: UserAcceptanceFields): boolean {
  return (
    user.termsVersion === CURRENT_VERSIONS.terms &&
    user.privacyVersion === CURRENT_VERSIONS.privacy &&
    !!user.termsAcceptedAt &&
    !!user.privacyAcceptedAt
  );
}

/** Documentos cujo aceite está desatualizado (vazio = tudo em dia). */
export function outdatedDocuments(
  user: UserAcceptanceFields,
): Array<"terms" | "privacy"> {
  const outdated: Array<"terms" | "privacy"> = [];
  if (!user.termsAcceptedAt || user.termsVersion !== CURRENT_VERSIONS.terms) {
    outdated.push("terms");
  }
  if (!user.privacyAcceptedAt || user.privacyVersion !== CURRENT_VERSIONS.privacy) {
    outdated.push("privacy");
  }
  return outdated;
}

/** Resumo do aceite vigente — usado em /configuracoes e no export de dados. */
export function acceptanceSummary(user: UserAcceptanceFields) {
  return {
    terms: {
      version: user.termsVersion ?? null,
      acceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
      currentVersion: CURRENT_VERSIONS.terms,
      upToDate: user.termsVersion === CURRENT_VERSIONS.terms && !!user.termsAcceptedAt,
    },
    privacy: {
      version: user.privacyVersion ?? null,
      acceptedAt: user.privacyAcceptedAt?.toISOString() ?? null,
      currentVersion: CURRENT_VERSIONS.privacy,
      upToDate: user.privacyVersion === CURRENT_VERSIONS.privacy && !!user.privacyAcceptedAt,
    },
  };
}
