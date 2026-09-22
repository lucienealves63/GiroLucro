import { and, desc, eq, or, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import {
  contactMessages,
  dataSubjectRequests,
  expenses,
  legalAcceptances,
  maintenances,
  notificationLogs,
  pageViews,
  passwordResetTokens,
  pushSubscriptions,
  sessions,
  settings,
  users,
  workEntries,
  type User,
} from "@/db/schema";
import { acceptanceSummary } from "@/lib/legal-acceptance";
import { BUSINESS_INFO } from "@/lib/business-info";
import { CURRENT_VERSIONS, PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";
import { DELETE_CONFIRMATION_WORD } from "@/lib/privacy-constants";

export { DELETE_CONFIRMATION_WORD };

/**
 * Direitos do titular (LGPD art. 18) — portabilidade e eliminação.
 *
 * Ambas as operações são sempre escopadas ao próprio usuário autenticado:
 * nenhuma consulta aqui aceita id vindo do cliente.
 */

/** Exportação completa dos dados da conta (portabilidade). */
export async function buildAccountExport(user: User) {
  const [settingsRows, entries, expenseRows, maintenanceRows, pushes, acceptances, requests, messages, views] =
    await Promise.all([
      db.select().from(settings).where(eq(settings.userId, user.id)),
      db.select().from(workEntries).where(eq(workEntries.userId, user.id)).orderBy(desc(workEntries.date)),
      db.select().from(expenses).where(eq(expenses.userId, user.id)).orderBy(desc(expenses.date)),
      db.select().from(maintenances).where(eq(maintenances.userId, user.id)).orderBy(desc(maintenances.date)),
      db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id)),
      db
        .select()
        .from(legalAcceptances)
        .where(eq(legalAcceptances.userId, user.id))
        .orderBy(desc(legalAcceptances.acceptedAt)),
      db
        .select()
        .from(dataSubjectRequests)
        .where(eq(dataSubjectRequests.userId, user.id))
        .orderBy(desc(dataSubjectRequests.createdAt)),
      db
        .select()
        .from(contactMessages)
        .where(
          or(
            eq(contactMessages.userId, user.id),
            eq(contactMessages.email, user.email),
          ),
        )
        .orderBy(desc(contactMessages.createdAt)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          firstSeen: sql<string | null>`min(${pageViews.createdAt})`,
          lastSeen: sql<string | null>`max(${pageViews.createdAt})`,
          paths: sql<string | null>`string_agg(distinct ${pageViews.path}, ', ')`,
        })
        .from(pageViews)
        .where(eq(pageViews.userId, user.id)),
    ]);

  const s = settingsRows[0] ?? null;
  const analyticsSummary = views[0];

  return {
    exportacao: {
      geradoEm: new Date().toISOString(),
      formato: "JSON (LGPD art. 18, II — portabilidade)",
      observacao:
        "Este arquivo contém os dados vinculados à sua conta no GiroLucro. Ele não inclui a sua senha (guardamos apenas um hash irreversível) nem as chaves técnicas das inscrições de notificação push.",
      versaoPoliticaPrivacidade: PRIVACY_VERSION,
      versaoTermosDeUso: TERMS_VERSION,
      controlador: {
        nome: BUSINESS_INFO.businessName,
        email: BUSINESS_INFO.supportEmail,
      },
    },
    conta: {
      id: user.id,
      nome: user.name,
      email: user.email,
      criadaEm: user.createdAt?.toISOString() ?? null,
      plano: {
        status: user.planStatus,
        ciclo: user.planCycle,
        acessoAte: user.currentPeriodEnd?.toISOString() ?? null,
        testeAte: user.trialEndsAt?.toISOString() ?? null,
      },
      aceites: acceptanceSummary(user),
      aceitesHistorico: acceptances.map((a) => ({
        documento: a.documentType,
        versao: a.documentVersion,
        aceitoEm: a.acceptedAt.toISOString(),
        origem: a.source,
      })),
    },
    compra: {
      provedor: user.paymentProvider ?? null,
      identificadorTransacao: user.paymentId ?? null,
      valor: user.paymentAmount ?? null,
      pagoEm: user.paidAt?.toISOString() ?? null,
      statusPagamento: user.paymentStatus ?? null,
      reembolso: {
        status: user.refundStatus ?? "none",
        solicitadoEm: user.refundRequestedAt?.toISOString() ?? null,
        reembolsadoEm: user.refundedAt?.toISOString() ?? null,
      },
    },
    configuracoes: s
      ? {
          veiculo: {
            tipo: s.vehicleType,
            apelido: s.vehicleName,
            consumoKmPorLitro: s.kmPerLiter,
            precoCombustivel: s.fuelPrice,
            manutencaoPorKm: s.maintenancePerKm,
            modoCombustivel: s.fuelMode,
            odometroInicial: s.initialOdometer,
          },
          custosFixosMensais: {
            aluguel: s.monthlyRent,
            celular: s.monthlyPhone,
            seguro: s.monthlyInsurance,
          },
          metas: {
            metaMensal: s.monthlyGoal,
            diasPorSemana: s.workDaysPerWeek,
            percentualReserva: s.reservePercent,
          },
          appsPersonalizados: s.platformsJson ?? null,
          atualizadoEm: s.updatedAt?.toISOString() ?? null,
        }
      : null,
    lancamentos: entries.map((e) => ({
      id: e.id,
      data: e.date,
      app: e.platform,
      periodo: e.period,
      bruto: e.gross,
      horas: e.hours,
      km: e.km,
      quantidade: e.quantity,
      esperaMinutos: e.waitMinutes,
      repasseRecebido: e.settled,
      criadoEm: e.createdAt?.toISOString() ?? null,
    })),
    despesas: expenseRows.map((x) => ({
      id: x.id,
      data: x.date,
      tipo: x.type,
      valor: x.amount,
      odometro: x.odometer,
      observacao: x.note,
      criadoEm: x.createdAt?.toISOString() ?? null,
    })),
    manutencoes: maintenanceRows.map((m) => ({
      id: m.id,
      tipo: m.type,
      data: m.date,
      km: m.kmDone,
      custo: m.cost,
      intervalokm: m.intervalKm,
      observacao: m.note,
      criadoEm: m.createdAt?.toISOString() ?? null,
    })),
    mensagensDeContato: messages.map((m) => ({
      id: m.id,
      assunto: m.topic,
      mensagem: m.body,
      telefone: m.phone,
      status: m.status,
      enviadaEm: m.createdAt.toISOString(),
      respondidaEm: m.answeredAt?.toISOString() ?? null,
    })),
    notificacoesPush: {
      dispositivos: pushes.length,
      inscricoes: pushes.map((p) => ({
        navegador: p.userAgent,
        criadaEm: p.createdAt.toISOString(),
        ultimoEnvioEm: p.lastSentAt?.toISOString() ?? null,
      })),
    },
    medicoesDeVisita: {
      observacao:
        "Registro de navegação coletado apenas com consentimento de analytics e não vinculado a dados de contato.",
      totalDeVisitasVinculadas: analyticsSummary?.total ?? 0,
      primeiraVisita: analyticsSummary?.firstSeen ?? null,
      ultimaVisita: analyticsSummary?.lastSeen ?? null,
      paginas: analyticsSummary?.paths ?? null,
    },
    solicitacoesRegistradas: requests.map((r) => ({
      tipo: r.requestType,
      status: r.status,
      registradaEm: r.createdAt.toISOString(),
      concluidaEm: r.completedAt?.toISOString() ?? null,
    })),
  };
}

/** Nome do arquivo de exportação (sem dado pessoal no nome). */
export function exportFileName(userId: number): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `girolucro-meus-dados-${userId}-${stamp}.json`;
}

/**
 * Exclusão da conta (LGPD art. 18, VI).
 *
 * 1. encerra sessões e tokens de recuperação de senha;
 * 2. remove inscrições de push e histórico de notificações;
 * 3. apaga dados operacionais (lançamentos, despesas, manutenções, ajustes);
 * 4. desvincula as medições de visita;
 * 5. se houve compra, mantém **apenas** o registro mínimo do pagamento
 *    (guarda fiscal / defesa de direitos) e anonimiza o cadastro;
 *    sem compra, a linha do usuário é apagada por completo;
 * 6. registra internamente a execução, sem dados pessoais.
 */
export async function deleteAccount(user: User): Promise<{ anonymized: boolean }> {
  const hasPurchase = Boolean(user.paymentId);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));
    await tx.delete(notificationLogs).where(eq(notificationLogs.userId, user.id));
    await tx.delete(workEntries).where(eq(workEntries.userId, user.id));
    await tx.delete(expenses).where(eq(expenses.userId, user.id));
    await tx.delete(maintenances).where(eq(maintenances.userId, user.id));
    await tx.delete(settings).where(eq(settings.userId, user.id));
    await tx.delete(pageViews).where(eq(pageViews.userId, user.id));

    // mensagens de contato do próprio titular (por conta ou por e-mail)
    await tx
      .delete(contactMessages)
      .where(
        or(eq(contactMessages.userId, user.id), eq(contactMessages.email, user.email)),
      );

    if (hasPurchase) {
      // anonimiza: mantém data/valor/identificador da transação para a guarda
      await tx
        .update(users)
        .set({
          name: "Conta excluída",
          email: `excluida+${user.id}@girolucro.invalid`,
          passwordHash: randomBytes(32).toString("hex"),
          planStatus: "deleted",
          planCycle: null,
          trialEndsAt: null,
          currentPeriodEnd: null,
          billingCustomerId: null,
          termsAcceptedAt: null,
          privacyAcceptedAt: null,
          termsVersion: null,
          privacyVersion: null,
          deletedAt: now,
        })
        .where(eq(users.id, user.id));
    } else {
      await tx.delete(users).where(eq(users.id, user.id));
    }

    await tx.insert(dataSubjectRequests).values({
      userId: user.id,
      requestType: "deletion",
      status: "done",
      channel: "app",
      note: hasPurchase ? "cadastro anonimizado; registro de compra mantido" : "cadastro removido",
      completedAt: now,
    });
  });

  return { anonymized: hasPurchase };
}

/** Registra uma solicitação de titular (exportação, correção, consentimento). */
export async function logDataSubjectRequest(params: {
  userId: number | null;
  requestType: "export" | "deletion" | "refund" | "correction" | "consent";
  status?: "received" | "processing" | "done" | "denied";
  note?: string | null;
}): Promise<void> {
  try {
    await db.insert(dataSubjectRequests).values({
      userId: params.userId,
      requestType: params.requestType,
      status: params.status ?? "done",
      channel: "app",
      note: params.note ?? null,
      completedAt: params.status && params.status !== "done" ? null : new Date(),
    });
  } catch (e) {
    // auditoria nunca pode derrubar a operação pedida pelo titular
    console.error("[lgpd] falha ao registrar solicitação:", e instanceof Error ? e.message : e);
  }
}

/** Conta anonimizada após exclusão (não pode ser usada para login). */
export async function findActiveUserById(id: number): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), sql`${users.planStatus} <> 'deleted'`))
    .limit(1);
  return row ?? null;
}
