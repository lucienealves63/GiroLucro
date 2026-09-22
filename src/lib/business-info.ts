/**
 * Identificação do fornecedor — fonte única de verdade.
 *
 * ⚠️ PENDÊNCIA DE NEGÓCIO: os campos marcados com `approved: false` precisam
 * ser preenchidos com as informações comerciais aprovadas pela responsável
 * pelo GiroLucro antes de publicar/divulgar. Enquanto estiverem vazios, o app
 * mostra um aviso discreto e NUNCA inventa CNPJ, CPF ou endereço residencial.
 *
 * Regra: não espalhar esses dados pelo código. Sempre importar daqui.
 */

export interface BusinessInfo {
  /** Nome comercial exibido ao público. */
  businessName: string;
  /** Nome jurídico / razão social do responsável (quando houver). */
  legalName: string;
  /** CNPJ ou identificação equivalente. Vazio = ainda não informado. */
  document: string;
  /** E-mail de atendimento e de assuntos de privacidade. */
  supportEmail: string;
  /** Endereço comercial (nunca residencial sem autorização expressa). */
  commercialAddress: string;
  /** Cidade/UF usada em textos quando o endereço completo não é publicado. */
  city: string;
  /** Horário/limite de resposta do atendimento. */
  supportHours: string;
}

/**
 * Dados comerciais. Trocar aqui atualiza landing page, rodapé, termos,
 * política de privacidade e checkout de uma só vez.
 *
 * Deixe `document` e `commercialAddress` vazios até a responsável aprovar a
 * publicação — o app trata isso de forma explícita (ver `vendorIsComplete`).
 */
export const BUSINESS_INFO: BusinessInfo = {
  businessName: "GiroLucro",
  legalName: "", // TODO(negócio): razão social / nome empresarial aprovado
  document: "", // TODO(negócio): CNPJ (ou identificação equivalente)
  supportEmail: "contato@girolucro.app.br",
  commercialAddress: "", // TODO(negócio): endereço comercial aprovado
  city: "", // TODO(negócio): cidade/UF do fornecedor
  supportHours: "atendimento em até 1 dia útil",
};

/** `true` quando todos os dados obrigatórios de identificação já foram preenchidos. */
export const vendorIsComplete = Boolean(
  BUSINESS_INFO.legalName.trim() &&
    BUSINESS_INFO.document.trim() &&
    BUSINESS_INFO.commercialAddress.trim(),
);

/** Monta a linha de identificação usada no rodapé e no checkout. */
export function vendorIdentifierLine(): string | null {
  const parts: string[] = [];
  const name = BUSINESS_INFO.legalName.trim();
  const doc = BUSINESS_INFO.document.trim();
  if (name) parts.push(name);
  if (doc) parts.push(`CNPJ/identificação: ${doc}`);
  return parts.length ? parts.join(" · ") : null;
}

/** Endereço comercial — ou null quando ainda não aprovado para publicação. */
export function vendorAddressLine(): string | null {
  const address = BUSINESS_INFO.commercialAddress.trim();
  if (address) return address;
  const city = BUSINESS_INFO.city.trim();
  return city || null;
}

/**
 * Aviso honesto enquanto a identificação do fornecedor não está publicada.
 * Aparece no rodapé e no checkout (transparência), nunca no lugar do CNPJ.
 */
export const VENDOR_PENDING_NOTICE =
  "Dados de identificação do fornecedor (razão social/CNPJ e endereço comercial) em processo de atualização.";

export const SUPPORT_EMAIL = BUSINESS_INFO.supportEmail;

/**
 * Prova social da landing page.
 *
 * ⚠️ Só publicar número com base real e verificável (contas ativas reais,
 * apuradas no painel). Enquanto não houver esse número aprovado, usamos uma
 * frase qualitativa — nunca uma quantidade inventada direto no JSX.
 */
export const SOCIAL_PROOF: {
  /** Ex.: 500 → "500 motoristas e entregadores usando". null = sem número. */
  approvedUsersCount: number | null;
  fallbackLabel: string;
} = {
  approvedUsersCount: null,
  fallbackLabel: "Feito para motoristas de app, entregadores e motoboys.",
};

/** Texto de prova social já pronto para render — qualitativo por padrão. */
export function socialProofLabel(): string {
  const count = SOCIAL_PROOF.approvedUsersCount;
  if (typeof count === "number" && Number.isFinite(count) && count > 0) {
    return `${count.toLocaleString("pt-BR")}+ motoristas e entregadores usando`;
  }
  return SOCIAL_PROOF.fallbackLabel;
}

/** Aviso obrigatório perto de qualquer demonstração com números simulados. */
export const SIMULATION_NOTICE =
  "Os valores são ilustrativos. Os resultados variam conforme custos, região, veículo, plataforma e forma de trabalho.";

/** Aviso para cálculos de decisão dentro do app ("vale a pena aceitar?"). */
export const DECISION_DISCLAIMER =
  "Estimativa baseada nos dados cadastrados. Considere trânsito, riscos, custos não registrados e suas condições reais antes de decidir.";
