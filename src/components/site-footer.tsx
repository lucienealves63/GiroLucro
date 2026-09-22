"use client";

import Link from "next/link";
import { Cookie } from "lucide-react";
import {
  BUSINESS_INFO,
  VENDOR_PENDING_NOTICE,
  vendorAddressLine,
  vendorIdentifierLine,
} from "@/lib/business-info";
import { openCookiePreferences } from "@/lib/cookie-consent";

/**
 * Rodapé jurídico do GiroLucro — usado na landing page e nas páginas
 * institucionais (Termos, Privacidade, Cookies, Ajuda).
 *
 * Contém os links exigidos e a identificação do fornecedor, sempre lida de
 * `src/lib/business-info.ts` (nunca duplicada no JSX).
 */
export function SiteFooter() {
  const identifier = vendorIdentifierLine();
  const address = vendorAddressLine();

  return (
    <footer className="border-t border-white/[0.06] px-5 py-10">
      <div className="mx-auto max-w-[1080px]">
        <nav aria-label="Links institucionais" className="flex flex-wrap gap-x-5 gap-y-2.5">
          {[
            { href: "/sobre", label: "Sobre" },
            { href: "/contato", label: "Contato" },
            { href: "/termos", label: "Termos de Uso" },
            { href: "/privacidade", label: "Política de Privacidade" },
            { href: "/cookies", label: "Política de Cookies" },
            { href: "/ajuda/compra-e-reembolso", label: "Compra e reembolso" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[12px] font-semibold text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline"
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={openCookiePreferences}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-zinc-400 underline-offset-4 hover:text-zinc-100 hover:underline"
          >
            <Cookie className="h-3.5 w-3.5" aria-hidden="true" />
            Preferências de cookies
          </button>
        </nav>

        <section aria-label="Identificação do fornecedor" className="mt-6 space-y-1">
          <p className="font-display text-[13px] font-bold text-zinc-200">
            {BUSINESS_INFO.businessName}
          </p>
          {identifier && <p className="text-[11.5px] leading-relaxed text-zinc-500">{identifier}</p>}
          {address && (
            <p className="text-[11.5px] leading-relaxed text-zinc-500">
              Endereço comercial: {address}
            </p>
          )}
          <p className="text-[11.5px] leading-relaxed text-zinc-500">
            E-mail:{" "}
            <a
              href={`mailto:${BUSINESS_INFO.supportEmail}`}
              className="font-semibold text-volt-300 underline underline-offset-4"
            >
              {BUSINESS_INFO.supportEmail}
            </a>{" "}
            · {BUSINESS_INFO.supportHours}
          </p>
          {!identifier && !address && (
            <p className="text-[11px] leading-relaxed text-zinc-600">{VENDOR_PENDING_NOTICE}</p>
          )}
        </section>

        <p className="mt-6 text-[10.5px] leading-relaxed text-zinc-600">
          O GiroLucro é uma ferramenta de organização e cálculo de lucro. Não somos
          instituição financeira, banco nem plataforma de crédito, e não temos vínculo
          com Uber, 99, iFood ou Rappi. Os resultados dependem dos dados que você
          informa. Demonstrações na landing page são exemplos ilustrativos de
          simulação — os resultados variam conforme custos, região, veículo,
          plataforma e forma de trabalho.
        </p>

        <p className="mt-4 text-[10.5px] font-medium tracking-wide text-zinc-600">
          © 2026 GiroLucro. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
