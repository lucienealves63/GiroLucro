"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cookie, Settings2 } from "lucide-react";
import {
  COOKIE_CONSENT_TEXT,
  CONSENT_EVENT,
  CONSENT_LABELS,
  OPEN_PREFERENCES_EVENT,
  applyConsent,
  readConsent,
  type ConsentValue,
} from "@/lib/cookie-consent";

/**
 * Banner de consentimento (primeira visita) e painel de preferências.
 *
 * - "Aceitar analytics"   → libera a medição de visitas (`gl_vid`);
 * - "Somente necessários" → o app funciona igual, sem medição opcional;
 * - "Saiba mais"          → /privacidade e /cookies.
 *
 * A escolha pode ser revista depois em Configurações › Privacidade ›
 * Preferências de cookies (este mesmo painel).
 */
const noopSubscribe = () => () => {};

/** A escolha vive no cookie: lida como fonte externa, não como estado local. */
function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_EVENT, onChange);
}

export function CookieConsent({
  /** Chamado quando o painel é fechado (para limpar o estado do chamador). */
  onClose,
}: {
  onClose?: () => void;
}) {
  // `hydrated` evita mostrar o banner no HTML do servidor (e o piscar de
  // "só apareceu depois de hidratar" para quem já escolheu antes).
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const consent = useSyncExternalStore(subscribeConsent, readConsent, () => null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Sincroniza com mudanças feitas em outro lugar do app e com o botão
  // "Preferências de cookies" (rodapé, configurações), que abre este painel.
  useEffect(() => {
    const onOpen = () => setPanelOpen(true);
    const onChange = () => setPanelOpen(false);
    window.addEventListener(OPEN_PREFERENCES_EVENT, onOpen);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => {
      window.removeEventListener(OPEN_PREFERENCES_EVENT, onOpen);
      window.removeEventListener(CONSENT_EVENT, onChange);
    };
  }, []);

  const choose = useCallback(
    (value: ConsentValue) => {
      applyConsent(value);
      setPanelOpen(false);
      onClose?.();
    },
    [onClose],
  );

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    onClose?.();
  }, [onClose]);

  if (!hydrated) return null;

  const showBanner = panelOpen || consent === null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          key="cookie-consent"
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-consent-title"
          aria-describedby="cookie-consent-text"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed inset-x-0 bottom-0 z-[70] mx-auto w-full max-w-[460px] px-3 pb-[max(env(safe-area-inset-bottom),12px)] md:max-w-[620px]"
        >
          <div className="rounded-3xl border border-white/[0.12] bg-[#0b0e13]/95 p-4 shadow-[0_20px_60px_-16px_rgba(0,0,0,0.85)] backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-volt-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h2
                  id="cookie-consent-title"
                  className="font-display text-[14px] font-bold text-zinc-50"
                >
                  Cookies e privacidade
                </h2>
                <p
                  id="cookie-consent-text"
                  className="mt-1 text-[12.5px] leading-relaxed text-zinc-300"
                >
                  {COOKIE_CONSENT_TEXT}
                </p>

                <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
                  {consent === "analytics"
                    ? "Hoje você está com: aceitar analytics."
                    : consent === "necessary"
                      ? "Hoje você está com: somente necessários (sem medição opcional)."
                      : "Nenhuma medição acontece antes da sua escolha."}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => choose("analytics")}
                    className="pressable rounded-2xl bg-volt-400 px-4 py-2.5 text-[12.5px] font-bold text-ink-950"
                  >
                    {CONSENT_LABELS.analytics}
                  </button>
                  <button
                    type="button"
                    onClick={() => choose("necessary")}
                    className="pressable rounded-2xl border border-white/[0.14] bg-white/[0.04] px-4 py-2.5 text-[12.5px] font-bold text-zinc-200"
                  >
                    {CONSENT_LABELS.necessary}
                  </button>
                  <Link
                    href="/cookies"
                    className="pressable inline-flex items-center gap-1.5 rounded-2xl px-3 py-2.5 text-[12.5px] font-bold text-volt-300 underline underline-offset-4"
                  >
                    <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Saiba mais
                  </Link>
                </div>

                {consent !== null && (
                  <button
                    type="button"
                    onClick={closePanel}
                    className="pressable mt-2 text-[11.5px] font-semibold text-zinc-500 underline underline-offset-4"
                  >
                    Fechar preferências
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
