"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Bell, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const registerPushSubscription = useCallback(async () => {
    if (!vapidPublicKey) return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });
      return response.ok;
    } catch (error) {
      console.error("Push subscription error:", error);
      return false;
    }
  }, [vapidPublicKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!vapidPublicKey) return;

    // Nunca abre a permissão automaticamente: navegadores exigem gesto do usuário.
    if (Notification.permission === "granted") {
      void registerPushSubscription();
    } else if (Notification.permission === "default") {
      setShow(true);
    }
  }, [registerPushSubscription, vapidPublicKey]);

  const handleEnable = () => {
    start(async () => {
      const permission = await Notification.requestPermission();
      if (permission === "granted") await registerPushSubscription();
      setShow(false);
    });
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-20 left-0 right-0 z-40 mx-4 flex items-center gap-3 rounded-2xl border border-volt-400/30 bg-[#0a0d10] px-4 py-3.5 shadow-lg"
        >
          <Bell className="h-5 w-5 shrink-0 text-volt-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-zinc-200">
              Receba lembretes de manutenção e metas
            </p>
            <p className="text-[11px] text-zinc-500">
              Alertas de revisão, vencimentos e metas mesmo com o app fechado
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleEnable}
              disabled={pending}
              className="pressable rounded-full bg-volt-400 px-3 py-1.5 text-[11px] font-bold text-ink-950 disabled:opacity-50"
            >
              {pending ? "..." : "Ativar"}
            </button>
            <button
              onClick={() => setShow(false)}
              aria-label="Agora não"
              className="pressable rounded-full p-1.5 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
