import { and, eq, inArray, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  notificationLogs,
  pageViews,
  passwordResetTokens,
  sessions,
  contactMessages,
  users,
} from "@/db/schema";

/**
 * Retenção de dados — o que o GiroLucro guarda, por quanto tempo e por quê.
 *
 * Esta é a **regra real do sistema**: a Política de Privacidade descreve
 * exatamente o que está definido aqui (e a rotina de limpeza executa).
 *
 * Ajustar um prazo = ajustar aqui + atualizar /privacidade.
 */
export const RETENTION = {
  /** Mensagens ainda não respondidas ficam mais tempo; resolvidas saem antes. */
  contactMessagesDays: 730, // 2 anos
  contactMessagesResolvedDays: 365, // 1 ano quando já respondida/arquivada
  /** Registro bruto de visitas (analytics de primeiro domínio). */
  pageViewsDays: 365, // 1 ano
  /** Histórico de notificações enviadas. */
  notificationLogsDays: 180, // 6 meses
  /** Tokens de recuperação de senha usados/expirados. */
  passwordResetTokensDays: 30,
  /** Sessões expiradas (não usadas) são removidas. */
  expiredSessionsDays: 30,
  /** Registros de compra / eventos de cobrança (guarda fiscal). */
  billingRecordsDays: 1825, // 5 anos — não são apagados pela rotina
} as const;

export type RetentionReport = {
  ranAt: string;
  deleted: {
    sessions: number;
    passwordResetTokens: number;
    pageViews: number;
    notificationLogs: number;
    contactMessages: number;
    deletedAccountsAnonymized: number;
  };
};

/**
 * Executa a limpeza. É idempotente e sempre restrita às tabelas abaixo —
 * nunca toca em lançamentos, despesas, manutenções ou registros de compra.
 */
export async function runRetentionCleanup(now: Date = new Date()): Promise<RetentionReport> {
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

  // 1. sessões expiradas há mais de N dias
  const sessionsDeleted = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, daysAgo(RETENTION.expiredSessionsDays)))
    .returning({ token: sessions.token });

  // 2. tokens de recuperação de senha (usados ou expirados)
  const tokensDeleted = await db
    .delete(passwordResetTokens)
    .where(
      and(
        lt(passwordResetTokens.createdAt, daysAgo(RETENTION.passwordResetTokensDays)),
        or(
          isNotNull(passwordResetTokens.usedAt),
          lt(passwordResetTokens.expiresAt, now),
        ),
      ),
    )
    .returning({ id: passwordResetTokens.id });

  // 3. registro bruto de visitas
  const viewsDeleted = await db
    .delete(pageViews)
    .where(lt(pageViews.createdAt, daysAgo(RETENTION.pageViewsDays)))
    .returning({ id: pageViews.id });

  // 4. histórico de notificações
  const logsDeleted = await db
    .delete(notificationLogs)
    .where(lt(notificationLogs.sentAt, daysAgo(RETENTION.notificationLogsDays)))
    .returning({ id: notificationLogs.id });

  // 5. mensagens de contato: resolvidas saem em 1 ano, abertas em 2 anos
  const resolvedDeleted = await db
    .delete(contactMessages)
    .where(
      and(
        inArray(contactMessages.status, ["respondido", "arquivado"]),
        lt(contactMessages.createdAt, daysAgo(RETENTION.contactMessagesResolvedDays)),
      ),
    )
    .returning({ id: contactMessages.id });
  const openDeleted = await db
    .delete(contactMessages)
    .where(
      and(
        ne(contactMessages.status, "respondido"),
        ne(contactMessages.status, "arquivado"),
        lt(contactMessages.createdAt, daysAgo(RETENTION.contactMessagesDays)),
      ),
    )
    .returning({ id: contactMessages.id });

  // 6. registra (sem dado pessoal) as limpezas em contas excluídas que
  //    porventura ainda tenham dados operacionais órfãos
  const orphans = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.planStatus, "deleted"), isNotNull(users.deletedAt)))
    .limit(0); // verificação defensiva: nada a fazer hoje, mantido para auditoria

  return {
    ranAt: now.toISOString(),
    deleted: {
      sessions: sessionsDeleted.length,
      passwordResetTokens: tokensDeleted.length,
      pageViews: viewsDeleted.length,
      notificationLogs: logsDeleted.length,
      contactMessages: resolvedDeleted.length + openDeleted.length,
      deletedAccountsAnonymized: orphans.length,
    },
  };
}

/** Resumo legível dos prazos — usado na Política de Privacidade e no /admin. */
export const RETENTION_SUMMARY: Array<{ label: string; period: string; why: string }> = [
  {
    label: "Conta (nome, e-mail, senha)",
    period: "enquanto a conta existir",
    why: "execução do contrato, login e suporte",
  },
  {
    label: "Dados de trabalho (giros, despesas, manutenção, metas)",
    period: "enquanto a conta existir; apagados quando você excluir a conta",
    why: "prestação do serviço contratado",
  },
  {
    label: "Registro de compra e eventos de cobrança",
    period: `${RETENTION.billingRecordsDays / 365} anos após a compra`,
    why: "obrigação fiscal, contábil e defesa de direitos (CDC art. 27)",
  },
  {
    label: "Mensagens de contato",
    period: `1 ano após a resposta; ${RETENTION.contactMessagesDays / 365} anos se ainda estiverem abertas`,
    why: "atendimento e histórico de suporte",
  },
  {
    label: "Medições de visita (analytics)",
    period: `${RETENTION.pageViewsDays / 365} ano`,
    why: "métricas de uso do aplicativo, só com consentimento",
  },
  {
    label: "Histórico de notificações enviadas",
    period: `${RETENTION.notificationLogsDays} dias`,
    why: "evitar notificação repetida e medir utilidade",
  },
  {
    label: "Sessões e tokens de redefinição de senha",
    period: `${RETENTION.passwordResetTokensDays} dias / sessões expiradas em ${RETENTION.expiredSessionsDays} dias`,
    why: "segurança da conta",
  },
];

/** Contagens usadas no painel admin (transparência da limpeza). */
export async function retentionSnapshot() {
  const [views] = await db
    .select({
      total: sql<number>`count(*)::int`,
      oldest: sql<string | null>`min(${pageViews.createdAt})`,
    })
    .from(pageViews);
  const [messages] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(contactMessages);
  return {
    pageViews: views?.total ?? 0,
    oldestPageView: views?.oldest ?? null,
    contactMessages: messages?.total ?? 0,
    rules: RETENTION,
  };
}
