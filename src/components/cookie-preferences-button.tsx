"use client";

import { Settings2 } from "lucide-react";
import { openCookiePreferences } from "@/lib/cookie-consent";

/**
 * Botão que reabre o painel de preferências de cookies de qualquer página
 * (Política de Cookies, Configurações, rodapé).
 */
export function CookiePreferencesButton({
  label = "Preferências de cookies",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={openCookiePreferences}
      className={
        className ??
        "pressable inline-flex items-center gap-2 rounded-2xl border border-volt-400/35 bg-volt-400/[0.08] px-4 py-3 text-[13px] font-bold text-volt-300"
      }
    >
      <Settings2 className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
