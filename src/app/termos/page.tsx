import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPageShell, LegalSection } from "@/components/legal-page";
import { BUSINESS_INFO, vendorAddressLine, vendorIdentifierLine } from "@/lib/business-info";
import {
  PRO_PAYMENT_LINES,
  PRO_PRICE_LABEL,
  PRO_PRODUCT_NAME,
} from "@/lib/billing";
import { REFUND_WINDOW_DAYS, TERMS_DOC } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Termos de Uso — GiroLucro",
  description:
    "Regras de uso do GiroLucro: o que é o serviço, período gratuito, compra em pagamento único, direito de arrependimento, responsabilidades e cancelamento.",
  robots: { index: true, follow: true },
};

/**
 * Termos de Uso (públicos). Descrevem o produto como ele é hoje:
 * ferramenta de organização e cálculo, período gratuito de 7 dias, compra em
 * pagamento único de R$ 19,90, sem assinatura e sem renovação automática.
 */
export default function TermosPage() {
  const identifier = vendorIdentifierLine();
  const address = vendorAddressLine();

  return (
    <LegalPageShell
      doc={TERMS_DOC}
      intro={
        <p>
          Estes termos regem o uso do GiroLucro, um aplicativo que calcula e organiza o lucro real
          de motoristas de aplicativo, entregadores e motoboys. Leia com atenção: ao criar a conta
          você declara que leu, entendeu e aceitou este documento e a Política de Privacidade.
        </p>
      }
    >
      <LegalSection number="1" title="O que é o GiroLucro">
        <p>
          O GiroLucro é um aplicativo (PWA) de organização financeira e cálculo para quem trabalha
          com transporte e entrega. Ele registra ganhos e despesas, desconta combustível, manutenção
          e custos fixos, mostra seu lucro líquido por hora, por quilômetro e por entrega, compara
          plataformas, controla metas, repasses e manutenções e envia lembretes.
        </p>
        <p>
          O GiroLucro é fornecido por{" "}
          <strong className="text-zinc-100">
            {BUSINESS_INFO.legalName || BUSINESS_INFO.businessName}
          </strong>
          {identifier ? <> — {identifier}</> : null}
          {address ? <> · {address}</> : null}. Contato:{" "}
          <a
            href={`mailto:${BUSINESS_INFO.supportEmail}`}
            className="font-semibold text-volt-300 underline underline-offset-4"
          >
            {BUSINESS_INFO.supportEmail}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection number="2" title="Quem pode usar">
        <LegalList
          items={[
            "Pessoas com 18 anos ou mais, capazes de contratar em nome próprio.",
            "Você é responsável pela veracidade do e-mail informado e pelo sigilo da sua senha.",
            "Uma conta por pessoa. O compartilhamento de credenciais ou o uso coletivo não são permitidos.",
          ]}
        />
      </LegalSection>

      <LegalSection number="3" title="Ferramenta de cálculo — não somos instituição financeira">
        <p>
          O GiroLucro é uma <strong className="text-zinc-100">ferramenta de organização e cálculo</strong>.
          Não somos banco, instituição financeira, plataforma de crédito, investimento ou seguros,
          e não fazemos pagamentos, transferências ou intermediação de valores entre você e as
          plataformas de corrida/entrega.
        </p>
        <p>
          <strong className="text-zinc-100">
            Todo resultado apresentado depende exclusivamente dos dados que você informa.
          </strong>{" "}
          Combustível, manutenção, custos fixos, metas e horas são estimativas matemáticas geradas a
          partir dos seus próprios registros. Bons resultados no app significam que os números
          cadastrados fecham — não uma promessa de ganho real, de renda ou de valor futuramente
          recebido.
        </p>
        <p>
          O GiroLucro não tem vínculo, patrocínio ou representação de Uber, 99, iFood, Rappi ou de
          qualquer outra plataforma. Marcas citadas pertencem aos seus titulares e aparecem apenas
          para identificar as comparações que você mesmo registra.
        </p>
      </LegalSection>

      <LegalSection number="4" title="Período gratuito">
        <LegalList
          items={[
            "Contas novas começam com 7 dias de acesso gratuito aos recursos Pro, sem pedir cartão e sem cobrança automática.",
            "O prazo aparece dentro do app e o app avisa quando estiver perto de terminar.",
            "Ao final do período gratuito, o acesso aos recursos Pro simplesmente se encerra. Não há cobrança, débito ou renovação — nada acontece sem que você faça uma compra.",
            "Seus registros continuam guardados para quando você quiser assinar.",
          ]}
        />
      </LegalSection>

      <LegalSection number="5" title="Compra do GiroLucro Pro">
        <LegalList
          items={[
            <>
              Produto: <strong className="text-zinc-100">{PRO_PRODUCT_NAME}</strong> —{" "}
              {PRO_PRICE_LABEL} em pagamento único.
            </>,
            "Pagamento processado pelo Mercado Pago (Pix, cartão de crédito ou checkout). O GiroLucro não recebe nem armazena dados do seu cartão.",
            "Não existe mensalidade, anuidade, assinatura recorrente ou renovação automática. Você pagará uma única vez.",
            "O GiroLucro pode pedir novo pagamento apenas se você decidir comprar novamente depois de excluir a conta ou de pedir reembolso.",
            "A liberação do acesso acontece automaticamente após a confirmação do pagamento pelo Mercado Pago — normalmente em segundos; no Pix, em poucos minutos.",
            "Se você pagar e o acesso não liberar, fale com o suporte: resolvemos e, se não for possível, devolvemos o valor integral.",
          ]}
        />
        <p className="text-[12.5px] text-zinc-400">
          {PRO_PAYMENT_LINES.join(" · ")}. Detalhes de prazo, meios aceitos e acompanhamento em{" "}
          <Link
            href="/ajuda/compra-e-reembolso"
            className="font-semibold text-volt-300 underline underline-offset-4"
          >
            Compra e reembolso
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection number="6" title="Direito de arrependimento e reembolso">
        <p>
          A compra acontece fora do estabelecimento comercial (internet), então você tem o direito
          de arrependimento previsto no art. 49 do Código de Defesa do Consumidor: pode desistir em
          até <strong className="text-zinc-100">{REFUND_WINDOW_DAYS} dias corridos</strong> contados
          do pagamento, recebendo <strong className="text-zinc-100">100% do valor de volta</strong>,
          sem precisar justificar.
        </p>
        <LegalList
          items={[
            "O pedido é feito em Configurações › Minha compra › “Solicitar arrependimento e reembolso”, ou pelo e-mail de suporte.",
            "Assim que o pedido é registrado, o acesso Pro é encerrado (o contrato é desfeito) e o reembolso é solicitado ao Mercado Pago.",
            "O prazo para o valor aparecer na sua conta ou fatura é definido pela operadora do cartão ou pelo seu banco — o GiroLucro não controla esse processamento.",
            "Pedidos fora do prazo legal também são recebidos e analisados individualmente, com resposta pelo e-mail da conta.",
            "Cada compra é reembolsada uma única vez: se já houve reembolso, novos pedidos para a mesma transação são recusados automaticamente.",
            "A solicitação de reembolso não é o mesmo que excluir a conta nem que “cancelar assinatura” — não existe assinatura para cancelar.",
          ]}
        />
      </LegalSection>

      <LegalSection number="7" title="Responsabilidades do usuário">
        <LegalList
          items={[
            "Informar dados corretos de veículo, consumo, custos e ganhos — o resultado depende disso.",
            "Manter a senha em sigilo e avisar imediatamente em caso de uso indevido.",
            "Usar o app apenas para fins lícitos, respeitando a legislação de trânsito, trabalhista, tributária e as regras das plataformas em que trabalha.",
            "Não tentar acessar contas de terceiros, automatizar acessos, explorar falhas, copiar o código ou revender o serviço.",
            "Emitir e declarar seus tributos conforme a sua situação fiscal (MEI, autônomo etc.) — o app não substitui contador nem obrigação fiscal.",
          ]}
        />
      </LegalSection>

      <LegalSection number="8" title="Responsabilidades do GiroLucro">
        <LegalList
          items={[
            "Manter o aplicativo disponível, corrigir erros e proteger os dados conforme a Política de Privacidade.",
            "Prestar suporte pelos canais oficiais, em até 1 dia útil.",
            "Avisar com antecedência sobre mudanças relevantes nestes termos ou no preço de novas compras.",
            "Proteger a segurança da conta com medidas técnicas adequadas (senha com hash, sessões controladas, tokens de uso único).",
          ]}
        />
        <p>
          O GiroLucro não responde por decisões de trabalho, aceitação de corridas, lucros esperados,
          multas, acidentes, bloqueios de conta em plataformas de terceiros ou por dados que você
          deixe de registrar.
        </p>
      </LegalSection>

      <LegalSection number="9" title="Uso abusivo e limite de uso">
        <p>
          Podemos suspender ou encerrar contas que abusem do serviço, tentem burlar limites
          técnicos, sobrecarregar a infraestrutura, usar o serviço para spam, fraude, crédito
          indevido de pagamento ou qualquer atividade ilícita. Quando possível, avisamos antes.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Disponibilidade, manutenção e mudanças">
        <p>
          O GiroLucro funciona como PWA e depende de conexão com a internet. Podemos fazer
          manutenções programadas ou emergenciais, e o serviço pode ficar indisponível por falhas de
          terceiros (hospedagem, banco de dados, processador de pagamento, operadoras).
        </p>
        <p>
          Podemos evoluir ou descontinuar funcionalidades. Se decidirmos encerrar o serviço, avisamos
          com antecedência razoável e você poderá exportar seus dados antes; compras muito recentes
          seguem a regra de reembolso do item 6.
        </p>
      </LegalSection>

      <LegalSection number="11" title="Propriedade intelectual">
        <p>
          O código, a marca, o nome, o layout, os textos e as ilustrações do GiroLucro pertencem ao
          seu titular e são protegidos pela Lei 9.610/1998 e pela Lei 9.279/1996. Você recebe uma
          licença pessoal, limitada, não exclusiva e não transferível de uso do aplicativo, pelo
          tempo de duração do acesso adquirido.
        </p>
        <p>
          Os dados que você cadastra são seus: você pode exportá-los (LGPD) e reutilizá-los como
          quiser. Usamos informações agregadas e anonimizadas para melhorar o produto.
        </p>
      </LegalSection>

      <LegalSection number="12" title="Encerramento da conta">
        <LegalList
          items={[
            "Você pode excluir a conta a qualquer momento em Configurações › Privacidade e meus dados › “Excluir minha conta”. A ação exige confirmação digitada e encerra todas as sessões.",
            "A exclusão apaga dados pessoais e operacionais. Registros de compra podem ser mantidos pelo prazo legal (guarda fiscal) e para defesa de direitos.",
            "A exclusão da conta é definitiva e não pode ser desfeita: lançamentos, metas e histórico não são recuperáveis.",
          ]}
        />
      </LegalSection>

      <LegalSection number="13" title="Privacidade e proteção de dados">
        <p>
          O tratamento de dados segue a Lei Geral de Proteção de Dados (Lei 13.709/2018). O que
          coletamos, por quê, onde fica, por quanto tempo e como exercer seus direitos está descrito
          na{" "}
          <Link
            href="/privacidade"
            className="font-semibold text-volt-300 underline underline-offset-4"
          >
            Política de Privacidade
          </Link>{" "}
          e na{" "}
          <Link href="/cookies" className="font-semibold text-volt-300 underline underline-offset-4">
            Política de Cookies
          </Link>
          . O aceite destes documentos fica registrado com versão e data/hora.
        </p>
      </LegalSection>

      <LegalSection number="14" title="Atendimento, foro e legislação">
        <p>
          Canal de atendimento:{" "}
          <a
            href={`mailto:${BUSINESS_INFO.supportEmail}`}
            className="font-semibold text-volt-300 underline underline-offset-4"
          >
            {BUSINESS_INFO.supportEmail}
          </a>{" "}
          ({BUSINESS_INFO.supportHours}). Você também pode registrar reclamação no consumidor.gov.br
          ou nos órgãos de defesa do consumidor.
        </p>
        <p>
          Estes termos são regidos pelas leis brasileiras, em especial o Código de Defesa do
          Consumidor (Lei 8.078/1990), o Marco Civil da Internet (Lei 12.965/2014) e a LGPD. Fica
          eleito o foro do domicílio do consumidor para resolver eventuais conflitos.
        </p>
        <p className="text-[12.5px] text-zinc-400">
          Versão {TERMS_DOC.version} — {TERMS_DOC.versionLabel}. Alterações relevantes geram nova
          versão e podem exigir novo aceite no app.
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
