"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Home,
  Plus,
  Target,
  Wrench,
} from "lucide-react";
import clsx from "clsx";
import { motion } from "framer-motion";

const items = [
  { href: "/", label: "Hoje", icon: Home },
  { href: "/comparar", label: "Comparar", icon: ArrowLeftRight },
  { href: "/registrar", label: "Registrar", icon: Plus, central: true },
  { href: "/manutencao", label: "Oficina", icon: Wrench },
  { href: "/metas", label: "Metas", icon: Target },
];

const HIDDEN_PREFIXES = [
  "/entrar",
  "/criar-conta",
  "/esqueci-senha",
  "/redefinir-senha",
  "/assinatura",
  "/landing",
  "/bem-vindo",
  "/sobre",
];

export function BottomNav() {
  const pathname = usePathname();
  const [isPublicRoot, setIsPublicRoot] = useState(false);

  // Se estiver em "/" mas a landing pública estiver renderizada (visitante não logado), esconde o nav
  useEffect(() => {
    if (pathname !== "/") {
      setIsPublicRoot(false);
      return;
    }
    const check = () => {
      const hasLanding = !!document.querySelector("[data-landing-root]");
      setIsPublicRoot(hasLanding);
    };
    check();
    // observa mudanças (a landing pode montar depois)
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [pathname]);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (isPublicRoot) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[460px]">
      <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-[var(--gl-nav-fade)] to-transparent" />
      <div className="border-t border-white/[0.07] bg-[color:var(--gl-nav)]/95 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur-xl">
        <div className="grid grid-cols-5 items-end px-2">
          {items.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            if (item.central) {
              return (
                <div key={item.href} className="flex justify-center">
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    className="pressable -mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-volt-400 text-ink-950 shadow-[0_10px_30px_-6px_rgba(184,245,60,0.5)]"
                  >
                    <item.icon className="h-6 w-6" strokeWidth={2.4} />
                  </Link>
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "pressable relative flex flex-col items-center gap-1 py-1.5",
                  active ? "text-volt-300" : "text-zinc-500",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-glow"
                    className="absolute -top-2 h-1 w-8 rounded-full bg-volt-400"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon className="h-[21px] w-[21px]" strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-semibold tracking-wide">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
