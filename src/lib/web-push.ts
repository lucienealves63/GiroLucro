import webpush from "web-push";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:support@girolucro.app";

// Configura o Web Push com as chaves VAPID
if (vapidPrivateKey && vapidPublicKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string; // agrupa notificações (ex: "manutencao-oleo")
  url?: string; // destino ao tocar na notificação
  requireInteraction?: boolean; // força o usuário a interagir
  actions?: Array<{ action: string; title: string }>;
}

/**
 * Envia notificação push para um dispositivo específico.
 */
export async function sendPush(
  subscription: { endpoint: string; auth: string; p256dh: string },
  payload: PushPayload,
) {
  if (!vapidPrivateKey) {
    console.warn("⚠️  VAPID_PRIVATE_KEY não configurado — notificações desabilitadas");
    return { success: false, error: "Notificações não configuradas" };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { auth: subscription.auth, p256dh: subscription.p256dh },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || "/icons/icon-512.png",
        badge: payload.badge || "/icons/icon-512.png",
        tag: payload.tag || "default",
        url: payload.url || "/",
        requireInteraction: payload.requireInteraction ?? false,
        actions: payload.actions || [],
      }),
    );
    return { success: true };
  } catch (e: any) {
    // 410 = subscription expirou (remover do banco)
    if (e.statusCode === 410 || e.statusCode === 404) {
      return { success: false, error: "subscription_expired", statusCode: e.statusCode };
    }
    console.error("Web Push error:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Gera as chaves VAPID (rodar uma vez e guardar no .env).
 * Comando: node -e "const wp = require('web-push'); const k = wp.generateVAPIDKeys(); console.log(k)"
 */
export function generateVAPIDKeys() {
  return webpush.generateVAPIDKeys();
}
