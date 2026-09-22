import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { BUSINESS_INFO } from "@/lib/business-info";
import type { LegalDocumentMeta } from "@/lib/legal";

/**
 * Moldura das páginas jurídicas e de ajuda (/termos, /privacidade, /cookies,
 * /ajuda/...). Acessível para visitante, para usuário logado e para leitores
 * de tela: um único <h1>, seções com <h2> e links reais no fim.
 */
export function LegalPageShell({
  doc,
  intro,
  children,
  updatedLabel,
}: {
  doc: LegalDocumentMeta;
  intro?: ReactNode;
  children: ReactNode;
  updatedLabel?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="px-5 pb-4 pt-6">
        <Link
          href="/"
          className="pressable inline-flex items-center gap-1.5 rounded-xl text-[12px] font-bold text-zinc-400 hover:text-zinc-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Voltar ao app
        </Link>
      </div>

      <article className="flex-1 px-5 pb-10">
        <header className="mb-6">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-volt-400">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {doc.title}
          </p>
          <h1 className="mt-2 font-display text-[27px] font-bold leading-tight tracking-tight text-zinc-50">
            {doc.title} do GiroLucro
          </h1>
          <p className="mt-2 text-[12px] font-semibold text-zinc-400">{doc.versionLabel}</p>
          <p className="text-[11.5px] text-zinc-500">
            Em vigor desde {updatedLabel ?? doc.effectiveLabel} · {BUSINESS_INFO.businessName} ·{" "}
            <a
              href={`mailto:${BUSINESS_INFO.supportEmail}`}
              className="font-semibold text-volt-300 underline underline-offset-4"
            >
              {BUSINESS_INFO.supportEmail}
            </a>
          </p>
          {intro && <div className="mt-4 text-[13.5px] leading-relaxed text-zinc-300">{intro}</div>}
        </header>

        <div className="space-y-6">{children}</div>
      </article>

      <SiteFooter />
    </div>
  );
}

/** Seção numerada dos documentos jurídicos. */
export function LegalSection({
  id,
  number,
  title,
  children,
}: {
  id?: string;
  number?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5">
      <h2 className="font-display text-[15px] font-bold text-zinc-50">
        {number && <span className="text-volt-400">{number}. </span>}
        {title}
      </h2>
      <div className="mt-2.5 space-y-2.5 text-[13px] leading-relaxed text-zinc-300">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-volt-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
