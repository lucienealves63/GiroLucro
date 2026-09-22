"use client";

/**
 * Inscrição/desinscrição de notificações push no navegador.
 *
 * Regra de ouro (e exigência de UX dos navegadores): a permissão só é pedida
 * depois de um gesto claro do usuário — nunca automaticamente ao abrir a
 * página. Além disso, o usuário pode desligar e some a inscrição no servidor.
 */

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export type PushToggleResult = {
  ok: boolean;
  /** Motivo legível quando `ok` é false (permissão negada, sem suporte etc.). */
  reason?: string;
  enabled?: boolean;
};

/** Ativa as notificações: pede permissão, inscreve o navegador e registra no backend. */
export async function enablePush(): Promise<PushToggleResult> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return { ok: false, reason: "Notificações não configuradas no servidor." };
  if (!pushSupported()) return { ok: false, reason: "Este navegador não suporta notificações." };

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "Permissão não concedida neste navegador." };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const res = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON(), userAgent: navigator.userAgent }),
    });
    if (!res.ok) return { ok: false, reason: "Não foi possível registrar este aparelho agora." };
    return { ok: true, enabled: true };
  } catch (error) {
    console.error("Push enable error:", error);
    return { ok: false, reason: "Não foi possível ativar as notificações agora." };
  }
}

/** Desativa: cancela a inscrição no navegador e apaga o registro no servidor. */
export async function disablePush(): Promise<PushToggleResult> {
  if (!pushSupported()) {
    // Sem suporte no navegador: ainda assim limpamos o servidor.
    await fetch("/api/notifications/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => null);
    return { ok: true, enabled: false };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    const endpoint = subscription?.endpoint ?? null;
    if (subscription) await subscription.unsubscribe().catch(() => false);

    const res = await fetch("/api/notifications/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(endpoint ? { endpoint } : { all: true }),
    });
    if (!res.ok) return { ok: false, reason: "Não foi possível desativar agora." };
    return { ok: true, enabled: false };
  } catch (error) {
    console.error("Push disable error:", error);
    return { ok: false, reason: "Não foi possível desativar as notificações agora." };
  }
}

/** Está ativo *neste aparelho* (permissão concedida + inscrição existente)? */
export async function pushEnabledHere(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription);
  } catch {
    return false;
  }
}
