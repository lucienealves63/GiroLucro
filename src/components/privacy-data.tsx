"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { CookiePreferencesButton } from "@/components/cookie-preferences-button";
import { Modal } from "@/components/modal";
import { SectionTitle, Toast, useToast } from "@/components/ui";
import { DELETE_CONFIRMATION_WORD } from "@/lib/privacy-constants";
import { formatDateTimeBR } from "@/lib/legal";

export type AcceptanceInfo = {
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  termsCurrentVersion: string;
  termsUpToDate: boolean;
  privacyVersion: string | null;
  privacyAcceptedAt: string | null;
  privacyCurrentVersion: string;
  privacyUpToDate: boolean;
};

/**
 * "Privacidade e meus dados" — central de direitos do titular (LGPD art. 18).
 *
 * Quatro caminhos: baixar, corrigir, gerenciar cookies e excluir a conta.
 * A exclusão é separada do fluxo de reembolso de propósito: são coisas
 * diferentes (o app é pagamento único, não assinatura).
 */
export function PrivacyDataSection({
  acceptance,
}: {
  acceptance: AcceptanceInfo;
}) {
  const router = useRouter();
  const { msg, show } = useToast();
  const [pending, start] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needsReacceptance = !acceptance.termsUpToDate || !acceptance.privacyUpToDate;

  const download = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export", { cache: "no-store" });
      if (!res.ok) {
        show("Não foi possível gerar o arquivo agora. Tente novamente.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `girolucro-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      show("Arquivo com seus dados gerado.");
    } catch {
      show("Sem conexão agora. Tente novamente em instantes.");
    } finally {
      setExporting(false);
    }
  };

  const acceptCurrent = () => {
    start(async () => {
      const res = await fetch("/api/account/legal", { method: "POST" });
      if (res.ok) {
        show("Aceite registrado. Obrigado!");
        router.refresh();
      } else {
        show("Não foi possível registrar o aceite agora.");
      }
    });
  };

  const deleteAccount = () => {
    setError(null);
    start(async () => {
      try {
        const res = await fetch("/api/account", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation: confirmWord }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "Não foi possível excluir a conta agora.");
          return;
        }
        setDeleteOpen(false);
        router.push("/?conta=excluida");
        router.refresh();
      } catch {
        setError("Sem conexão agora. Tente novamente em instantes.");
      }
    });
  };

  const rows = [
    {
      icon: Download,
      title: "Baixar meus dados",
      hint: "Arquivo JSON com tudo que está vinculado à sua conta (LGPD art. 18, II).",
      action: (
        <button
          type="button"
          onClick={download}
          disabled={exporting}
          className="pressable rounded-2xl border border-volt-400/35 bg-volt-400/[0.08] px-3.5 py-2 text-[12px] font-bold text-volt-300 disabled:opacity-50"
        >
          {exporting ? "Gerando..." : "Baixar"}
        </button>
      ),
    },
    {
      icon: Pencil,
      title: "Corrigir meus dados",
      hint: "Veículo, custos e metas você edita aqui mesmo; nome e e-mail pelo suporte.",
      action: (
        <Link
          href="/contato"
          className="pressable rounded-2xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-[12px] font-bold text-zinc-200"
        >
          Pedir correção
        </Link>
      ),
    },
    {
      icon: CheckCircle2,
      title: "Gerenciar cookies",
      hint: "Mude entre “Somente necessários” e “Aceitar analytics” quando quiser.",
      action: <CookiePreferencesButton label="Preferências" className="pressable rounded-2xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-2 text-[12px] font-bold text-zinc-200" />,
    },
    {
      icon: Trash2,
      title: "Excluir minha conta",
      hint: "Apaga seus dados pessoais e operacionais. Não é o mesmo que reembolso.",
      action: (
        <button
          type="button"
          onClick={() => {
            setConfirmWord("");
            setError(null);
            setDeleteOpen(true);
          }}
          className="pressable rounded-2xl border border-rose-400/30 bg-rose-400/[0.08] px-3.5 py-2 text-[12px] font-bold text-rose-300"
        >
          Excluir
        </button>
      ),
    },
  ];

  return (
    <div>
      <SectionTitle>Privacidade e meus dados</SectionTitle>

      <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="flex flex-col gap-3.5">
          {rows.map((row) => (
            <div
              key={row.title}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-3.5 last:border-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <row.icon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-volt-400" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-zinc-200">{row.title}</p>
                  <p className="text-[11.5px] leading-relaxed text-zinc-500">{row.hint}</p>
                </div>
              </div>
              {row.action}
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
          <p className="text-[12px] font-bold text-zinc-200">Aceites registrados</p>
          <ul className="mt-1.5 flex flex-col gap-1 text-[11.5px] text-zinc-400">
            <li>
              Termos de Uso v{acceptance.termsVersion ?? "—"} ·{" "}
              {acceptance.termsAcceptedAt
                ? `aceito em ${formatDateTimeBR(acceptance.termsAcceptedAt)}`
                : "aceite não registrado"}
            </li>
            <li>
              Política de Privacidade v{acceptance.privacyVersion ?? "—"} ·{" "}
              {acceptance.privacyAcceptedAt
                ? `aceita em ${formatDateTimeBR(acceptance.privacyAcceptedAt)}`
                : "aceite não registrado"}
            </li>
          </ul>
          {needsReacceptance && (
            <div className="mt-3">
              <p className="text-[11.5px] leading-relaxed text-amber-200">
                Publicamos uma versão nova (Termos v{acceptance.termsCurrentVersion} · Privacidade v
                {acceptance.privacyCurrentVersion}). Confirme o aceite para continuar em dia.
              </p>
              <button
                type="button"
                onClick={acceptCurrent}
                disabled={pending}
                className="pressable mt-2 rounded-2xl bg-volt-400 px-4 py-2.5 text-[12px] font-bold text-ink-950 disabled:opacity-50"
              >
                Aceitar versão atual
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Tem certeza? Essa ação pode apagar permanentemente seus dados do GiroLucro."
        labelledById="delete-account-title"
        description="Apagamos seus dados pessoais e operacionais e encerramos todas as sessões. Se houver compra registrada, mantemos apenas o mínimo exigido por obrigação legal (data, valor e identificador da transação)."
      >
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
            Digite {DELETE_CONFIRMATION_WORD} para confirmar
          </span>
          <input
            type="text"
            value={confirmWord}
            onChange={(e) => setConfirmWord(e.target.value.toUpperCase())}
            autoComplete="off"
            aria-describedby="delete-account-help"
            placeholder={DELETE_CONFIRMATION_WORD}
            className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.03] px-3.5 py-3 font-display text-[15px] font-bold tracking-[0.2em] text-zinc-100 placeholder:text-zinc-700"
          />
        </label>
        <p id="delete-account-help" className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
          A exclusão é definitiva: lançamentos, metas e histórico não podem ser recuperados. Se você
          quer apenas desfazer a compra, use “Solicitar arrependimento e reembolso” em Minha compra.
        </p>

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/[0.07] px-3.5 py-2.5 text-[12px] font-semibold text-rose-300">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={deleteAccount}
            disabled={pending || confirmWord.trim().toUpperCase() !== DELETE_CONFIRMATION_WORD}
            className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 py-3.5 font-display text-[14px] font-bold text-white disabled:opacity-40"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {pending ? "Excluindo..." : "Excluir minha conta definitivamente"}
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(false)}
            className="pressable w-full rounded-2xl border border-white/[0.1] py-3 text-[13px] font-bold text-zinc-300"
          >
            Manter minha conta
          </button>
        </div>
      </Modal>

      <Toast msg={msg} />
    </div>
  );
}
