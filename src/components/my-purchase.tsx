"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BadgeCheck, Clock3, Loader2, Receipt, RotateCcw, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import { Modal } from "@/components/modal";
import { SectionTitle, Toast, useToast } from "@/components/ui";
import { brl } from "@/lib/format";
import { PRO_PAYMENT_LINES, PRO_PRICE_LABEL, PRO_PRODUCT_NAME } from "@/lib/billing";
import { REFUND_WINDOW_DAYS } from "@/lib/legal";

export type PurchaseInfo = {
  /** Data do pagamento (ISO) ou null quando não há compra. */
  paidAt: string | null;
  amount: number | null;
  provider: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
  refundStatus: string | null;
  refundRequestedAt: string | null;
  refundedAt: string | null;
  /** Já se passaram mais de 7 dias desde a compra? */
  outsideWindow: boolean;
  /** Está dentro do prazo do art. 49 do CDC? */
  withinWindow: boolean;
};

const PROVIDER_LABELS: Record<string, string> = {
  mercado_pago: "Mercado Pago",
  pix: "Pix (Mercado Pago)",
  demo: "Ambiente de demonstração",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  approved: "Pago",
  pending: "Aguardando confirmação",
  rejected: "Não aprovado",
  refunded: "Reembolsado",
  charged_back: "Estornado pelo banco (chargeback)",
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  none: "Sem pedido de reembolso",
  requested: "Pedido de reembolso em análise",
  processing: "Reembolso em processamento",
  manual: "Pedido em análise manual pela equipe",
  refunded: "Reembolso realizado",
  denied: "Pedido de reembolso não aprovado",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

/**
 * "Minha compra" — transparência do pagamento único + arrependimento.
 *
 * Deixa explícito que o GiroLucro não tem assinatura recorrente: não existe
 * "cancelar assinatura"; existe pedido de reembolso (CDC art. 49) e, em outro
 * lugar, exclusão da conta.
 */
export function MyPurchaseSection({ purchase }: { purchase: PurchaseInfo }) {
  const router = useRouter();
  const { msg, show } = useToast();
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refunded = purchase.refundStatus === "refunded" || purchase.paymentStatus === "refunded";
  const inAnalysis =
    purchase.refundStatus === "requested" ||
    purchase.refundStatus === "processing" ||
    purchase.refundStatus === "manual";

  const requestRefund = () => {
    start(async () => {
      try {
        const res = await fetch("/api/billing/refund", { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        if (!res.ok) {
          show(data.error ?? "Não foi possível registrar o pedido agora.");
          return;
        }
        setConfirmOpen(false);
        show(data.message ?? "Recebemos seu pedido de reembolso.");
        router.refresh();
      } catch {
        show("Sem conexão agora. Tente novamente em instantes.");
      }
    });
  };

  return (
    <div>
      <SectionTitle>Minha compra</SectionTitle>

      {!purchase.paidAt ? (
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5">
          <p className="flex items-center gap-2 text-[13px] font-bold text-zinc-200">
            <Receipt className="h-4 w-4 text-volt-400" aria-hidden="true" />
            Nenhuma compra registrada nesta conta
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-400">
            O GiroLucro Pro é uma compra de <strong className="text-zinc-200">pagamento único</strong>{" "}
            ({PRO_PRICE_LABEL}) — {PRO_PAYMENT_LINES.join(" · ").toLowerCase()}. Enquanto você não
            compra, o acesso fica no período gratuito.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/assinatura"
              className="pressable rounded-2xl bg-volt-400 px-4 py-2.5 text-[12.5px] font-bold text-ink-950"
            >
              Ver o Pro
            </Link>
            <Link
              href="/ajuda/compra-e-reembolso"
              className="pressable rounded-2xl border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-[12.5px] font-bold text-zinc-200"
            >
              Como funciona a compra
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5">
          <dl className="flex flex-col gap-2 text-[12.5px]">
            {[
              { label: "Produto", value: PRO_PRODUCT_NAME },
              { label: "Data da compra", value: formatDate(purchase.paidAt) },
              {
                label: "Valor pago",
                value: purchase.amount !== null ? brl(purchase.amount) : "—",
              },
              { label: "Pagamento único", value: "Sim — sem mensalidade e sem renovação automática" },
              {
                label: "Forma de pagamento",
                value: purchase.provider
                  ? PROVIDER_LABELS[purchase.provider] ?? purchase.provider
                  : "Mercado Pago",
              },
              {
                label: "Status",
                value: purchase.paymentStatus
                  ? PAYMENT_STATUS_LABELS[purchase.paymentStatus] ?? purchase.paymentStatus
                  : "—",
              },
              {
                label: "Reembolso",
                value: purchase.refundStatus
                  ? REFUND_STATUS_LABELS[purchase.refundStatus] ?? purchase.refundStatus
                  : "Sem pedido de reembolso",
              },
              {
                label: "Identificador da transação",
                value: purchase.paymentId ?? "—",
              },
            ].map((row) => (
              <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.05] pb-2 last:border-0 last:pb-0">
                <dt className="text-zinc-500">{row.label}</dt>
                <dd className="max-w-[70%] truncate text-right font-semibold text-zinc-200" title={row.value}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          {refunded && (
            <p className="mt-4 flex items-start gap-2 rounded-2xl border border-volt-400/25 bg-volt-400/[0.07] px-3.5 py-3 text-[12px] leading-relaxed text-volt-200">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Reembolso registrado em {formatDate(purchase.refundedAt)}. O prazo para o valor
              aparecer na sua conta ou fatura é definido pela operadora do cartão ou pelo banco.
            </p>
          )}

          {inAnalysis && !refunded && (
            <p className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-3.5 py-3 text-[12px] leading-relaxed text-amber-200">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Pedido registrado em {formatDate(purchase.refundRequestedAt)}. A confirmação chega no
              e-mail da sua conta.
            </p>
          )}

          {!refunded && !inAnalysis && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
              className={clsx(
                "pressable mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-[13px] font-bold disabled:opacity-50",
                purchase.withinWindow
                  ? "border-volt-400/35 bg-volt-400/[0.08] text-volt-300"
                  : "border-white/[0.12] bg-white/[0.03] text-zinc-300",
              )}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {purchase.withinWindow
                ? "Solicitar arrependimento e reembolso"
                : "Solicitar análise de reembolso"}
            </button>
          )}

          <p className="mt-3 flex items-start gap-2 text-[11.5px] leading-relaxed text-zinc-500">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Isto <strong className="text-zinc-400">não é cancelamento de assinatura</strong> — o
              GiroLucro é compra de pagamento único. Pedir reembolso desfaz a compra e encerra o
              acesso Pro. Para apagar seus dados, use “Excluir minha conta” em Privacidade e meus
              dados.{" "}
              <Link
                href="/ajuda/compra-e-reembolso"
                className="font-semibold text-volt-300 underline underline-offset-4"
              >
                Entenda o passo a passo
              </Link>
              .
            </span>
          </p>
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={
          purchase.withinWindow
            ? "Solicitar arrependimento e reembolso?"
            : "Solicitar análise de reembolso?"
        }
        labelledById="refund-modal-title"
        description={
          purchase.withinWindow
            ? `Você está dentro do prazo de ${REFUND_WINDOW_DAYS} dias do art. 49 do Código de Defesa do Consumidor. Vamos pedir o estorno de 100% do valor ao Mercado Pago e o acesso Pro será encerrado.`
            : `Sua compra foi há mais de ${REFUND_WINDOW_DAYS} dias. O pedido será registrado para análise da nossa equipe e a resposta chega pelo e-mail da sua conta.`
        }
      >
        <ul className="flex flex-col gap-2 text-[12.5px] leading-relaxed text-zinc-300">
          <li>• O valor devolvido é de {purchase.amount !== null ? brl(purchase.amount) : PRO_PRICE_LABEL}.</li>
          <li>• Após o pedido, o acesso aos recursos Pro é encerrado.</li>
          <li>• Cada compra pode ser reembolsada uma única vez.</li>
          <li>• Seus dados continuam na conta, a menos que você peça a exclusão.</li>
        </ul>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={requestRefund}
            disabled={pending}
            className="pressable flex w-full items-center justify-center gap-2 rounded-2xl bg-volt-400 py-3.5 font-display text-[14px] font-bold text-ink-950 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {pending ? "Registrando pedido..." : "Confirmar pedido de reembolso"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="pressable w-full rounded-2xl border border-white/[0.1] py-3 text-[13px] font-bold text-zinc-300"
          >
            Voltar sem pedir
          </button>
        </div>
      </Modal>

      <Toast msg={msg} />
    </div>
  );
}
