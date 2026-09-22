"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

/**
 * Modal acessível (WCAG 2.1 AA / WAI-ARIA):
 *  - `role="dialog"` + `aria-modal="true"` com título associado;
 *  - foco entra no diálogo ao abrir e volta para o elemento anterior ao fechar;
 *  - Esc fecha e o Tab fica preso dentro do modal;
 *  - clique no fundo fecha;
 *  - respeita `prefers-reduced-motion` (as animações do framer-motion herdam
 *    a preferência via CSS global `* { animation-duration: 0.01ms }`).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  labelledById = "gl-modal-title",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  labelledById?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute("aria-hidden"));

    // foco inicial: primeiro elemento focável (ou o próprio painel)
    const first = focusables()[0];
    (first ?? panel)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center px-3 pb-3 sm:items-center sm:pb-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledById}
            aria-describedby={description ? `${labelledById}-desc` : undefined}
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="relative z-10 max-h-[88dvh] w-full max-w-[440px] overflow-y-auto rounded-3xl border border-white/[0.12] bg-[#0b0e13] p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id={labelledById} className="font-display text-[16px] font-bold text-zinc-50">
                {title}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="pressable -mr-1 -mt-1 rounded-full p-2 text-zinc-500 hover:text-zinc-200"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {description && (
              <p id={`${labelledById}-desc`} className="mt-2 text-[13px] leading-relaxed text-zinc-300">
                {description}
              </p>
            )}
            <div className="mt-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
