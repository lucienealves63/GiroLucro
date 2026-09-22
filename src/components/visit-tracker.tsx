"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, analyticsAllowed, readConsent } from "@/lib/cookie-consent";

/**
 * O consentimento vive no cookie (`document.cookie`), ou seja, fora do React.
 * `useSyncExternalStore` é a forma correta de ler essa fonte externa: nada de
 * setState dentro de efeito e o valor se mantém atualizado quando o visitante
 * muda de ideia em qualquer tela do app.
 */
function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_EVENT, onChange);
}

/**
 * Medidor de visitas do próprio GiroLucro (primeiro domínio, sem cookie
 * de terceiro). Monta no layout raiz, então conta tanto a landing pública
 * quanto as páginas do app.
 *
 * ⚠️ Consentimento primeiro (LGPD): o medidor NÃO cria nenhum identificador
 * antes de o visitante escolher "Aceitar analytics" no banner de cookies.
 * Se a pessoa escolher "Somente necessários" — ou ainda não tiver escolhido —
 * nada é gerado e nada é enviado ao servidor.
 *
 * Quando o consentimento é dado:
 * - `gl_vid`  → visitante único (persiste 1 ano, para "pessoas únicas")
 * - `gl_sid`  → visita/aba (para páginas por visita e bounce)
 * - ao sair da página envia o tempo gasto (sendBeacon) → "tempo médio"
 */

const VISITOR_COOKIE = "gl_vid";
const SESSION_KEY = "gl_sid";

function readCookie(name: string): string {
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}

function writeCookie(name: string, value: string, days: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${days * 86400}; SameSite=Lax`;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function visitorId(): string {
  try {
    const fromCookie = readCookie(VISITOR_COOKIE);
    if (fromCookie) return fromCookie;
    const fromStore = localStorage.getItem(VISITOR_COOKIE);
    const id = /^[A-Za-z0-9_-]{8,64}$/.test(fromStore ?? "") ? (fromStore as string) : uuid();
    writeCookie(VISITOR_COOKIE, id, 365);
    try {
      localStorage.setItem(VISITOR_COOKIE, id);
    } catch {
      /* modo privado: o cookie ainda funciona */
    }
    return id;
  } catch {
    return uuid();
  }
}

function sessionId(): string {
  try {
    const current = sessionStorage.getItem(SESSION_KEY);
    if (current) return current;
    const id = uuid();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return uuid();
  }
}

export function VisitTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  const viewId = useRef<number>(0);
  const enteredAt = useRef<number>(0); // preenchido no efeito (evita impureza no render)
  const consent = useSyncExternalStore(subscribeConsent, readConsent, () => null);

  useEffect(() => {
    // Nada é medido sem "Aceitar analytics" — a checagem lê o cookie direto,
    // então nem um primeiro render atrasado cria identificador à toa.
    if (!analyticsAllowed()) return;

    const path = pathname || "/";
    if (lastPath.current === path) return; // StrictMode/dev double-invoke
    lastPath.current = path;
    enteredAt.current = Date.now();

    const vid = visitorId();
    const sid = sessionId();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // credentials: same-origin → o cookie de sessão chega e o painel sabe
      // que aquela visita é de um assinante
      credentials: "same-origin",
      referrerPolicy: "unsafe-url",
      signal: controller.signal,
      body: JSON.stringify({
        path,
        url: window.location.href,
        referrer: document.referrer || null,
        visitorId: vid,
        sessionId: sid,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { id?: number } | null) => {
        if (data?.id) viewId.current = Number(data.id) || 0;
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));

    const sendDwell = () => {
      const dwellMs = Date.now() - enteredAt.current;
      if (!viewId.current || dwellMs < 1200) return;
      const payload = JSON.stringify({ viewId: String(viewId.current), dwellMs });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            "/api/visit",
            new Blob([payload], { type: "application/json" }),
          );
          return;
        }
      } catch {
        /* cai no fetch abaixo */
      }
      fetch("/api/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    };

    const onHide = () => {
      if (document.visibilityState === "hidden") sendDwell();
    };
    window.addEventListener("pagehide", sendDwell);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", sendDwell);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [pathname, consent]);

  return null;
}
