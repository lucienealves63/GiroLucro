"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Bell, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { enablePush, pushPermission, pushSupported } from "@/lib/push-client";

/**
 * Convite para ativar notificações.
 *
 * Regras aplicadas (privacidade + boas práticas dos navegadores):
 *  - só aparece para usuário **logado** e depois que a página carregou —
 *    nada de pedir permissão ao abrir o app pela primeira vez;
 *  - a permissão do navegador é pedida apenas no clique em "Ativar";
 *  - quem já decidiu (permitiu ou bloqueou) não vê o convite de novo;
 *  - "Agora não" fica registrado neste aparelho por 30 dias.
 */

const DISMISS_KEY = "gl_push_prompt_dismissed_at";
const DISMISS_DAYS = 30;

function dismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const when = Number(raw);
    if (!Number.isFinite(when)) return false;
    return Date.now() - when < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function NotificationPrompt() {
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();

  const register = useCallback(async () => {
    const result = await enablePush();
    return result.ok;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pushSupported()) return;
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;
    if (pushPermission() !== "default") return;
    if (dismissedRecently()) return;

    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/notifications/status", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          authenticated?: boolean;
          configured?: boolean;
        };
        // Visitante (landing/cadastro) nunca recebe convite de notificação.
        if (!cancelled && data.authenticated && data.configured) setShow(true);
      } catch {
        /* sem servidor: simplesmente não mostra */
      }
    };
    // pequena espera para não competir com o primeiro carregamento
    const timer = setTimeout(check, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const handleEnable = () => {
    start(async () => {
      const ok = await register();
      if (!ok) {
        try {
          localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
          /* sem storage */
        }
      }
      setShow(false);
    });
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* sem storage */
    }
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="dialog"
          aria-label="Ativar notificações"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-20 left-0 right-0 z-40 mx-4 flex items-center gap-3 rounded-2xl border border-volt-400/30 bg-[#0a0d10] px-4 py-3.5 shadow-lg"
        >
          <Bell className="h-5 w-5 shrink-0 text-volt-400" aria-hidden="true" />
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
              onClick={handleDismiss}
              aria-label="Agora não"
              className="pressable rounded-full p-1.5 text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
