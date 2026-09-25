import { and, eq, gte, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { notificationLogs, users } from "@/db/schema";
import {
  purchaseReceiptEmail,
  refundWindowReminderEmail,
  sendTransactionalEmail,
  type MailResult,
} from "@/lib/email";
import { REFUND_WINDOW_DAYS } from "@/lib/legal";
import { getAppUrl } from "@/lib/password-reset";

/**
 * E-mails de pós-venda do pagamento único (nunca lançam para fora — o fluxo de
 * cobrança continua válido mesmo sem provedor de e-mail configurado):
 *
 *  1. **recibo** — quando o pagamento é confirmado (recibo, identificador da
 *     transação e o prazo de arrependimento por escrito, como manda o CDC);
 *  2. **lembrete** — 2 dias antes do fim do prazo de arrependimento, só para
 *     quem comprou e ainda não pediu nada (aviso de transparência, não oferta).
 */

const DAY_MS = 86_400_000;

/** Tipo gravado em `notification_logs` — evita mandar o mesmo lembrete 2x. */
export const REMINDER_LOG_TYPE = "email_lembrete_reembolso";

/** Quantos dias antes do fim do prazo o lembrete começa a ser enviado. */
export const REMINDER_DAYS_BEFORE = 3;

export function refundDeadlineFor(paidAt: Date): Date {
  return new Date(paidAt.getTime() + REFUND_WINDOW_DAYS * DAY_MS);
}

/** Dias restantes arredondados para cima (1 = último dia). */
export function daysLeft(deadline: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS));
}

/** Tela onde a pessoa vê o recibo e pede o reembolso. */
export function purchaseSettingsUrl(): string {
  return `${getAppUrl()}/configuracoes#minha-compra`;
}

export type Purchase = {
  paymentId: string;
  provider: string | null;
  amount: number | null;
  paidAt: Date;
};

/**
 * Recibo da compra. Chame **depois** de gravar o pagamento no banco e apenas
 * quando a compra é nova (repetir o webhook não deve gerar outro recibo).
 */
export async function sendPurchaseReceipt(
  user: { name: string; email: string },
  purchase: Purchase,
): Promise<MailResult> {
  const message = purchaseReceiptEmail({
    firstName: user.name.split(" ")[0] || "tudo bem",
    amount: purchase.amount,
    paidAt: purchase.paidAt,
    paymentId: purchase.paymentId,
    provider: purchase.provider,
    refundDeadline: refundDeadlineFor(purchase.paidAt),
    settingsUrl: purchaseSettingsUrl(),
  });
  const result = await sendTransactionalEmail({ to: user.email, ...message });
  console.info(
    `[pos-venda] recibo da compra ${purchase.paymentId}: ${result.sent ? "enviado" : `não enviado (${result.error})`}`,
  );
  return result;
}

export type ReminderReport = {
  ranAt: string;
  /** Banda consultada (ISO). */
  window: { from: string; to: string };
  candidates: number;
  sent: number;
  failed: number;
  /** Preenchido quando nada pôde sair (ex.: Resend ausente). */
  skipped: string | null;
  /** E-mails (mascarados) de quem recebeu — útil no teste manual. */
  recipients: string[];
};

/**
 * Lembrete do prazo de arrependimento.
 *
 * A consulta pega quem comprou entre 4 e 6 dias atrás (prazo de 7 dias) e ainda
 * não pediu reembolso; o log em `notification_logs` garante **um envio por
 * pessoa**, mesmo que a rotina rode mais de uma vez no dia.
 */
export async function runRefundWindowReminders(
  options: { now?: Date; dryRun?: boolean; limit?: number } = {},
): Promise<ReminderReport> {
  const now = options.now ?? new Date();
  const from = new Date(now.getTime() - (REFUND_WINDOW_DAYS - 1) * DAY_MS);
  const to = new Date(now.getTime() - (REFUND_WINDOW_DAYS - REMINDER_DAYS_BEFORE) * DAY_MS);
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);

  const report: ReminderReport = {
    ranAt: now.toISOString(),
    window: { from: from.toISOString(), to: to.toISOString() },
    candidates: 0,
    sent: 0,
    failed: 0,
    skipped: null,
    recipients: [],
  };

  const candidates = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      paidAt: users.paidAt,
      paymentAmount: users.paymentAmount,
      planStatus: users.planStatus,
      refundStatus: users.refundStatus,
    })
    .from(users)
    .where(
      and(
        eq(users.planStatus, "active"),
        eq(users.paymentStatus, "approved"),
        // conta de teste não passou por compra: nada de lembrete de reembolso
        eq(users.isTest, false),
        isNull(users.deletedAt),
        isNotNull(users.paidAt),
        gte(users.paidAt, from),
        lt(users.paidAt, to),
        // Fora da lista: quem já está com pedido em andamento ou já foi
        // reembolsado. "denied" volta a receber o aviso — pode pedir de novo.
        or(
          isNull(users.refundStatus),
          notInArray(users.refundStatus, ["requested", "processing", "manual", "refunded"]),
        ),
      ),
    )
    .limit(limit);

  report.candidates = candidates.length;
  if (!candidates.length) return report;

  if (options.dryRun) {
    report.recipients = candidates.map((u) => u.email);
    return report;
  }

  for (const user of candidates) {
    const paidAt = user.paidAt as Date;
    const deadline = refundDeadlineFor(paidAt);

    const [already] = await db
      .select({ id: notificationLogs.id })
      .from(notificationLogs)
      .where(and(eq(notificationLogs.userId, user.id), eq(notificationLogs.type, REMINDER_LOG_TYPE)))
      .limit(1);
    if (already) continue;

    const left = daysLeft(deadline, now);
    const message = refundWindowReminderEmail({
      firstName: user.name.split(" ")[0] || "tudo bem",
      amount: user.paymentAmount ?? null,
      paidAt,
      refundDeadline: deadline,
      daysLeft: left,
      settingsUrl: purchaseSettingsUrl(),
    });
    const result = await sendTransactionalEmail({ to: user.email, ...message });

    if (!result.sent) {
      report.failed += 1;
      report.skipped = result.error;
      // Sem log: se o e-mail voltar a funcionar, a próxima execução tenta de novo.
      continue;
    }

    report.sent += 1;
    report.recipients.push(user.email);
    await db
      .insert(notificationLogs)
      .values({
        userId: user.id,
        type: REMINDER_LOG_TYPE,
        title: message.subject,
        body: `Lembrete do prazo de arrependimento (${left} dia${left === 1 ? "" : "s"} restante${left === 1 ? "" : "s"}).`,
      })
      .catch((e) => {
        console.error(
          "[pos-venda] falha ao registrar o lembrete enviado:",
          e instanceof Error ? e.message : e,
        );
      });
  }

  return report;
}

/** Quantos lembretes já foram enviados (usado no diagnóstico do admin). */
export async function reminderLogCount(): Promise<number> {
  try {
    const [row] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(notificationLogs)
      .where(eq(notificationLogs.type, REMINDER_LOG_TYPE));
    return row?.total ?? 0;
  } catch {
    return 0;
  }
}
