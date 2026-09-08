import cron from "node-cron";
import { db } from "@/db";
import {
  users,
  pushSubscriptions,
  notificationLogs,
  workEntries,
  maintenances,
} from "@/db/schema";
import { eq, and, gt, lt, gte } from "drizzle-orm";
import { sendPush } from "@/lib/web-push";
import { currentOdometer, maintenanceStatuses } from "@/lib/calculations";
import { getAppData } from "@/lib/data";

/**
 * Dispara lembretes todos os dias às 08h (UTC-3).
 * Verifica: trial expirando, manutenção urgente, meta do dia.
 */
export function startNotificationCron() {
  if (process.env.NODE_ENV !== "production" && !process.env.RUN_CRON_LOCAL) {
    console.log("ℹ️  Cron de notificações desabilitado (defina RUN_CRON_LOCAL para dev)");
    return;
  }

  // 08:00 UTC-3 = 11:00 UTC
  cron.schedule("0 11 * * *", async () => {
    console.log("🔔 Iniciando envio de notificações programadas...");
    try {
      await notifyTrialExpiring();
      await notifyMaintenanceUrgent();
      await notifyDailyGoal();
    } catch (e) {
      console.error("Cron error:", e);
    }
  });

  console.log("✅ Cron de notificações inicializado");
}

/**
 * Notifica usuários cujo trial termina em 2 dias ou menos.
 */
async function notifyTrialExpiring() {
  const now = new Date();
  const inTwoDays = new Date(now.getTime() + 2 * 86400000);

  const expiring = await db
    .select({ id: users.id, name: users.name, trialEndsAt: users.trialEndsAt })
    .from(users)
    .where(
      and(
        eq(users.planStatus, "trialing"),
        gte(users.trialEndsAt, now),
        lt(users.trialEndsAt, inTwoDays),
      ),
    );

  for (const user of expiring) {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.id));
    if (subs.length === 0) continue;

    const daysLeft = Math.ceil(
      (user.trialEndsAt!.getTime() - now.getTime()) / 86400000,
    );
    const firstName = user.name.split(" ")[0];

    for (const sub of subs) {
      await sendPush(
        { endpoint: sub.endpoint, auth: sub.auth, p256dh: sub.p256dh },
        {
          title: "Seu trial vence em breve, " + firstName,
          body: `${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} restantes. Assine Pro para não perder seus dados.`,
          icon: "/icons/icon-512.png",
          tag: "trial-expira",
          requireInteraction: true,
        },
      );
    }

    // Log
    await db.insert(notificationLogs).values({
      userId: user.id,
      type: "trial_expira",
      title: "Trial vencendo em " + daysLeft + " dias",
      body: "Clique para assinar Pro",
    });
  }

  console.log(`✉️  ${expiring.length} avisos de trial enviados`);
}

/**
 * Notifica usuários com manutenção urgente/vencida.
 */
async function notifyMaintenanceUrgent() {
  // Busca todos os usuários com push subscriptions
  const allSubs = await db.selectDistinct({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions);

  for (const row of allSubs) {
    const userId = row.userId;
    try {
      const data = await getAppData(userId);
      const odo = currentOdometer(data.settings, data.entries, data.expenses);
      const statuses = maintenanceStatuses(data.maintenances, odo);

      // Filtra urgentes/vencidas que ainda não foram notificadas hoje
      const urgent = statuses.filter((s) => s.status === "urgente" || s.status === "vencido");
      if (urgent.length === 0) continue;

      const subs = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));

      const firstName = (await db.select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId)))[0]?.name.split(" ")[0] || "Você";

      for (const sub of subs) {
        await sendPush(
          { endpoint: sub.endpoint, auth: sub.auth, p256dh: sub.p256dh },
          {
            title: "⚠️ Manutenção " + (urgent[0].status === "vencido" ? "VENCIDA" : "urgente"),
            body: `${urgent[0].label} está ${urgent[0].status === "vencido" ? "vencida" : "para vencer em breve"}. Leve seu veículo à oficina.`,
            tag: `manutencao-${urgent[0].type}`,
            requireInteraction: true,
          },
        );
      }

      // Log
      for (const m of urgent) {
        await db.insert(notificationLogs).values({
          userId,
          type: "manutencao_urgente",
          title: m.label + " urgente/vencida",
          body: `${Math.round(m.remainingKm)} km restantes`,
        });
      }
    } catch (e) {
      console.error(`Erro ao buscar dados do usuário ${userId}:`, e);
    }
  }

  console.log(`⚠️  Avisos de manutenção urgente enviados`);
}

/**
 * Notifica usuários às 08h sobre meta do dia.
 */
async function notifyDailyGoal() {
  const allUsers = await db.select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.planStatus, "active"));

  for (const user of allUsers) {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.id));
    if (subs.length === 0) continue;

    try {
      const data = await getAppData(user.id);
      if (data.settings.monthlyGoal <= 0) continue;

      const dayGoal = data.settings.monthlyGoal / (data.settings.workDaysPerWeek * 4.345);
      const firstName = user.name.split(" ")[0];

      for (const sub of subs) {
        await sendPush(
          { endpoint: sub.endpoint, auth: sub.auth, p256dh: sub.p256dh },
          {
            title: "Bom dia, " + firstName + "! 📱",
            body: `Meta de hoje: R$ ${dayGoal.toFixed(2)}. Abra o app para acompanhar.`,
            tag: "meta-diaria",
            url: "/metas",
          },
        );
      }

      // Log
      await db.insert(notificationLogs).values({
        userId: user.id,
        type: "meta_diaria",
        title: "Aviso de meta diária",
        body: `R$ ${dayGoal.toFixed(2)} para hoje`,
      });
    } catch (e) {
      console.error(`Erro ao processar meta de ${user.id}:`, e);
    }
  }

  console.log(`📊 Avisos de meta diária enviados`);
}
