/**
 * Assuntos do formulário de contato — arquivo separado (e sem dependências
 * de servidor) para poder ser importado por um client component.
 */

export const CONTACT_TOPICS = [
  { id: "duvida", label: "Dúvida sobre o app", hint: "como funciona, trial, preço" },
  { id: "bug", label: "Encontrei um erro", hint: "tela quebrada, número estranho" },
  { id: "pagamento", label: "Pagamento ou assinatura", hint: "Pix, recibo, acesso Pro" },
  { id: "recurso", label: "Quero uma função nova", hint: "ideia de melhoria" },
  { id: "parceria", label: "Parceria", hint: "coop, oficina, frota" },
  { id: "outro", label: "Outro assunto", hint: "escreva à vontade" },
] as const;

export type ContactTopicId = (typeof CONTACT_TOPICS)[number]["id"];

export const CONTACT_TOPIC_IDS: string[] = CONTACT_TOPICS.map((t) => t.id);

export function topicLabel(id: string): string {
  return CONTACT_TOPICS.find((t) => t.id === id)?.label ?? "Contato";
}
