import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPageShell, LegalSection } from "@/components/legal-page";
import { BUSINESS_INFO } from "@/lib/business-info";
import { PRO_PAYMENT_LINES, PRO_PRICE_LABEL, PRO_PRODUCT_NAME } from "@/lib/billing";
import { COOKIES_DOC, REFUND_WINDOW_DAYS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Compra e reembolso — Ajuda GiroLucro",
  description:
    "Como funciona a compra do GiroLucro Pro: pagamento único de R$ 19,90, meios aceitos, prazo de ativação, arrependimento, reembolso e suporte.",
  robots: { index: true, follow: true },
};

/**
 * Página de ajuda sobre compra e reembolso — linkada no checkout, no rodapé
 * e nos Termos de Uso.
 */
export default function AjudaCompraEReembolsoPage() {
  return (
    <LegalPageShell
      doc={{
        ...COOKIES_DOC,
        id: "terms",
        title: "Ajuda · Compra e reembolso",
        versionLabel: "Atualizado em setembro de 2026",
      }}
      intro={
        <p>
          Aqui está tudo o que acontece quando você compra o GiroLucro Pro — sem letra miúda e sem
          surpresa na fatura.
        </p>
      }
      updatedLabel="setembro de 2026"
    >
      <LegalSection number="1" title="Como funciona a compra">
        <LegalList
          items={[
            <>
              Produto: <strong className="text-zinc-100">{PRO_PRODUCT_NAME}</strong>.
            </>,
            <>
              Preço: <strong className="text-zinc-100">{PRO_PRICE_LABEL}</strong> —{" "}
              {PRO_PAYMENT_LINES.join(" · ").toLowerCase()}.
            </>,
            "O pagamento é feito uma única vez. Não existe assinatura, mensalidade ou renovação automática: nada será cobrado de novo depois desta compra.",
            "Antes de pagar, o checkout mostra o resumo do que você está comprando (produto, valor, pagamento único) e os links dos Termos de Uso, da Política de Privacidade e desta página.",
            "O processamento é feito pelo Mercado Pago. O GiroLucro não recebe nem guarda os dados do seu cartão.",
          ]}
        />
      </LegalSection>

      <LegalSection number="2" title="Período gratuito antes de comprar">
        <p>
          Toda conta nova tem 7 dias de acesso gratuito aos recursos Pro, sem pedir cartão. Ao final,
          o acesso se encerra e você decide se quer comprar — nenhuma cobrança acontece
          automaticamente.
        </p>
      </LegalSection>

      <LegalSection number="3" title="Meios de pagamento aceitos">
        <LegalList
          items={[
            "Pix (QR Code gerado no app, com validade de 60 minutos) — liberação automática após a confirmação.",
            "Cartão de crédito e demais meios do Checkout Mercado Pago (a disponibilidade varia conforme a sua conta).",
            "O GiroLucro não aceita boleto, transferência direta ou pagamento em dinheiro.",
          ]}
        />
      </LegalSection>

      <LegalSection number="4" title="Prazo de ativação">
        <LegalList
          items={[
            "Pix e cartão: a liberação é automática, normalmente em segundos após a confirmação do pagamento.",
            "Se o pagamento aparecer como aprovado no Mercado Pago e o acesso não liberar em alguns minutos, feche e abra o app ou toque em “Já paguei, verificar”.",
            "Não liberou mesmo assim? Fale com o suporte e resolvemos; se não conseguirmos liberar, devolvemos o valor integral.",
          ]}
        />
      </LegalSection>

      <LegalSection number="5" title="Arrependimento e reembolso">
        <p>
          A compra é feita fora do estabelecimento comercial, então vale o art. 49 do Código de
          Defesa do Consumidor: você pode desistir em até{" "}
          <strong className="text-zinc-100">{REFUND_WINDOW_DAYS} dias corridos</strong> contados do
          pagamento e receber <strong className="text-zinc-100">100% do valor</strong>, sem
          justificar o motivo.
        </p>
        <LegalList
          items={[
            <>
              Caminho no app: <strong className="text-zinc-100">Configurações › Minha compra</strong>{" "}
              › botão “Solicitar arrependimento e reembolso”.
            </>,
            "Assim que o pedido é registrado, o acesso Pro é encerrado (a compra é desfeita) e o estorno é solicitado ao Mercado Pago.",
            "O prazo para o dinheiro voltar depende do meio de pagamento e é definido pelo Mercado Pago, pela operadora do cartão ou pelo seu banco.",
            "Pedidos enviados depois dos 7 dias também são recebidos: entram em análise e a resposta chega pelo e-mail da conta.",
            "Cada compra só pode ser reembolsada uma vez. Se já existir reembolso para a transação, o pedido é recusado automaticamente.",
          ]}
        />
        <p className="text-[12.5px] text-zinc-400">
          Importante: pedir reembolso é diferente de apagar a conta. Se quiser apagar tudo, use
          Configurações › Privacidade e meus dados › “Excluir minha conta”.
        </p>
      </LegalSection>

      <LegalSection number="6" title="Como acompanhar seu pedido">
        <LegalList
          items={[
            "Em Configurações › Minha compra você vê data, valor, forma de pagamento e o status atual (pago, em análise, reembolsado).",
            "Enviamos um e-mail de confirmação assim que o pedido de reembolso é registrado.",
            "Dúvidas no meio do caminho? Responda o e-mail recebido ou escreva para o suporte informando o e-mail da conta.",
          ]}
        />
      </LegalSection>

      <LegalSection number="7" title="Onde está meu comprovante?">
        <p>
          O comprovante é emitido pelo Mercado Pago para a transação aprovada e também aparece no
          seu extrato/fatura do meio de pagamento. O identificador da transação fica registrado na
          sua conta e pode ser consultado na exportação de dados (Configurações › Privacidade e meus
          dados › “Baixar meus dados”). Precisando de um documento comercial do fornecedor, peça
          pelo e-mail de suporte.
        </p>
      </LegalSection>

      <LegalSection number="8" title="Suporte e canais oficiais">
        <p>
          E-mail:{" "}
          <a
            href={`mailto:${BUSINESS_INFO.supportEmail}`}
            className="font-semibold text-volt-300 underline underline-offset-4"
          >
            {BUSINESS_INFO.supportEmail}
          </a>{" "}
          · {BUSINESS_INFO.supportHours}. Você também pode usar o formulário em{" "}
          <Link href="/contato" className="font-semibold text-volt-300 underline underline-offset-4">
            /contato
          </Link>{" "}
          (assunto “Pagamento”).
        </p>
        <p className="text-[12.5px] text-zinc-400">
          Veja também os{" "}
          <Link href="/termos" className="font-semibold text-volt-300 underline underline-offset-4">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link
            href="/privacidade"
            className="font-semibold text-volt-300 underline underline-offset-4"
          >
            Política de Privacidade
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
