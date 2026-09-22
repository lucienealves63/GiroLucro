import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPageShell, LegalSection } from "@/components/legal-page";
import { BUSINESS_INFO, vendorAddressLine, vendorIdentifierLine } from "@/lib/business-info";
import { PRIVACY_DOC } from "@/lib/legal";
import { RETENTION_SUMMARY } from "@/lib/retention";

export const metadata: Metadata = {
  title: "Política de Privacidade — GiroLucro",
  description:
    "Como o GiroLucro coleta, usa, armazena e elimina seus dados. Versão 1.0, em conformidade com a LGPD (Lei 13.709/2018).",
  robots: { index: true, follow: true },
};

/**
 * Política de Privacidade (pública — visitante, usuário logado, cadastro e
 * checkout podem ler). O conteúdo descreve o comportamento real do sistema:
 * cada categoria abaixo corresponde a colunas/tabelas existentes no banco e
 * aos prazos definidos em src/lib/retention.ts.
 */

const DATA_CATEGORIES: Array<{
  title: string;
  items: string;
  purpose: string;
  basis: string;
}> = [
  {
    title: "Identificação e acesso",
    items: "Nome, e-mail e dados de autenticação (senha guardada apenas como hash irreversível).",
    purpose:
      "Criar e proteger sua conta, permitir login, recuperar senha e identificar você no atendimento.",
    basis: "Execução de contrato (art. 7º, V) e legítimo interesse em segurança (art. 7º, IX).",
  },
  {
    title: "Dados financeiros que você cadastra",
    items:
      "Faturamento por plataforma, despesas (combustível, alimentação, manutenção, outros), quilometragem, tempo de espera, repasses recebidos/pendentes, dados do veículo (consumo, preço do combustível, odômetro), custos fixos, metas diárias/mensais, reserva e provisões.",
    purpose:
      "Calcular seu lucro líquido real, por hora, por quilômetro e por entrega, além de comparar plataformas. Sem esses dados o aplicativo não produz nenhum resultado.",
    basis: "Execução de contrato (art. 7º, V).",
  },
  {
    title: "Mensagens enviadas pelo formulário de contato",
    items: "Nome, e-mail, telefone (opcional), assunto e o texto da mensagem.",
    purpose:
      "Responder ao seu contato, registrar o histórico do atendimento e coibir abuso/spam no formulário.",
    basis: "Consentimento e legítimo interesse em atendimento e segurança (art. 7º, I e IX).",
  },
  {
    title: "Dados técnicos de acesso e medição de visitas",
    items:
      "Identificador de visitante de primeiro domínio “gl_vid”, identificador de sessão/aba (guardado apenas na memória da aba), página visitada, origem do acesso (referenciador, UTM), tipo de dispositivo, navegador, sistema operacional, idioma, país e tempo de permanência na página. Não guardamos seu endereço IP nesse registro.",
    purpose:
      "Entender quantas pessoas usam o GiroLucro, de onde vêm e quais telas funcionam ou não. Isso só acontece se você escolher “Aceitar analytics” no banner de cookies.",
    basis: "Consentimento (art. 7º, I), revogável a qualquer momento em Configurações.",
  },
  {
    title: "Notificações push",
    items:
      "Inscrição gerada pelo seu navegador (endpoint e chaves técnicas), navegador/dispositivo e histórico das notificações enviadas.",
    purpose: "Enviar lembretes que você ativou (manutenção, metas e fim do período gratuito).",
    basis: "Consentimento (art. 7º, I) — a permissão é pedida pelo navegador após ação sua.",
  },
  {
    title: "Informações relacionadas a pagamentos",
    items:
      "Identificador da transação no Mercado Pago, valor pago, data, meio de pagamento, status do pagamento e, quando houver, status do reembolso. O GiroLucro não guarda número de cartão nem dados bancários — eles ficam com o Mercado Pago.",
    purpose:
      "Liberar o acesso Pro, manter o comprovante da compra, processar arrependimento/reembolso e cumprir obrigações fiscais e de defesa de direitos.",
    basis:
      "Execução de contrato (art. 7º, V), cumprimento de obrigação legal (art. 7º, II) e exercício regular de direitos (art. 7º, VI).",
  },
  {
    title: "Registros de aceite dos documentos",
    items: "Versão aceita dos Termos de Uso e da Política de Privacidade, data/hora do aceite e origem do aceite.",
    purpose: "Demonstrar transparência na contratação e cumprir os arts. 7º e 8º da LGPD e o CDC.",
    basis: "Cumprimento de obrigação legal e exercício regular de direitos (art. 7º, II e VI).",
  },
];

const THIRD_PARTIES: Array<{ name: string; role: string; data: string; location: string }> = [
  {
    name: "Vercel",
    role: "Hospedagem do aplicativo",
    data: "Executa o site, registra logs técnicos e processa as requisições feitas ao app.",
    location: "Servidores nos Estados Unidos, com nós na América Latina (transferência internacional).",
  },
  {
    name: "Neon",
    role: "Banco de dados PostgreSQL",
    data: "Armazena todas as informações descritas nesta política (conta, dados de trabalho, mensagens e registros de pagamento).",
    location: "Servidores em nuvem nos Estados Unidos (transferência internacional).",
  },
  {
    name: "Mercado Pago",
    role: "Processamento de pagamentos",
    data: "Recebe nome, e-mail, valor e identificação da compra para processar o pagamento (Pix, cartão ou checkout), emitir o comprovante e executar reembolsos.",
    location: "Empresa e infraestrutura no Brasil.",
  },
  {
    name: "Resend",
    role: "Envio de e-mails transacionais",
    data: "E-mail da conta e conteúdo das mensagens de sistema (redefinição de senha, recibo de contato, confirmação de reembolso).",
    location: "Servidores em nuvem nos Estados Unidos (transferência internacional).",
  },
  {
    name: "Serviço de push do seu navegador",
    role: "Entrega das notificações",
    data: "Quando você ativa notificações, o navegador (Google, Mozilla ou Apple) transporta a mensagem até o seu aparelho.",
    location: "Conforme o fornecedor do seu navegador.",
  },
];

export default function PrivacidadePage() {
  const identifier = vendorIdentifierLine();
  const address = vendorAddressLine();

  return (
    <LegalPageShell
      doc={PRIVACY_DOC}
      intro={
        <>
          <p>
            Esta política explica, sem letra miúda, quais dados o {BUSINESS_INFO.businessName}{" "}
            coleta, por que coleta, onde eles ficam, por quanto tempo são guardados e como você
            pode acessar, corrigir, exportar ou apagar tudo.
          </p>
          <p className="mt-2">
            Falamos de dados de trabalho (giros, despesas, quilometragem), de conta (nome, e-mail) e
            de navegação. Nunca vendemos seus dados e não compartilhamos seus números com Uber, 99,
            iFood, Rappi ou qualquer outra plataforma.
          </p>
        </>
      }
    >
      <LegalSection number="1" title="Quem é o controlador dos seus dados">
        <p>
          O controlador dos dados tratados pelo GiroLucro é{" "}
          <strong className="text-zinc-100">
            {BUSINESS_INFO.legalName || BUSINESS_INFO.businessName}
          </strong>
          {identifier ? <> — {identifier}</> : null}.
        </p>
        <p>
          Contato do encarregado/canal de privacidade:{" "}
          <a
            href={`mailto:${BUSINESS_INFO.supportEmail}`}
            className="font-semibold text-volt-300 underline underline-offset-4"
          >
            {BUSINESS_INFO.supportEmail}
          </a>
          {address ? <> · {address}</> : null}. Respondemos solicitações de titular em até 15 dias.
        </p>
      </LegalSection>

      <LegalSection number="2" title="Quais dados coletamos e para quê">
        <div className="flex flex-col gap-4">
          {DATA_CATEGORIES.map((category) => (
            <div key={category.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <h3 className="font-display text-[13.5px] font-bold text-zinc-100">{category.title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-300">
                <strong className="text-zinc-200">O que:</strong> {category.items}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-300">
                <strong className="text-zinc-200">Por quê:</strong> {category.purpose}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">
                <strong className="text-zinc-300">Base legal:</strong> {category.basis}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3">
          Também tratamos dados de forma agregada e anonimizada (total de visitas, telas mais
          usadas) para entender o desempenho do aplicativo. Depois de agregados, esses números não
          permitem identificar você.
        </p>
      </LegalSection>

      <LegalSection number="3" title="Cookies e o identificador gl_vid">
        <p>
          Usamos cookies <strong className="text-zinc-100">necessários</strong> (sessão de login,
          segurança, tema e a sua própria escolha de cookies) e, apenas com o seu consentimento,
          tecnologias de <strong className="text-zinc-100">analytics</strong> — incluindo o
          identificador <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[11.5px]">gl_vid</code>.
        </p>
        <LegalList
          items={[
            <>
              O <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[11.5px]">gl_vid</code>{" "}
              é criado no seu próprio navegador (primeiro domínio), dura 1 ano e serve para contar
              “pessoas diferentes” sem depender de IP ou de cookies de terceiros.
            </>,
            <>
              Se você escolher <strong className="text-zinc-100">“Somente necessários”</strong>,
              nenhum identificador de medição é criado, nada é enviado ao servidor e o app funciona
              normalmente. Se já existia, ele é apagado.
            </>,
            <>
              Você pode mudar de ideia quando quiser em{" "}
              <Link href="/cookies" className="font-semibold text-volt-300 underline underline-offset-4">
                Política de Cookies
              </Link>{" "}
              ou em Configurações › Privacidade › Preferências de cookies.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection number="4" title="Onde os dados ficam armazenados">
        <p>
          Os dados ficam em banco de dados PostgreSQL contratado (Neon) e a aplicação roda em
          hospedagem em nuvem (Vercel). O acesso é protegido por credenciais de ambiente, tráfego
          criptografado (HTTPS) e senhas guardadas apenas como hash com salt (scrypt), o que impede
          a leitura da sua senha por quem acessa o banco.
        </p>
        <p>
          <strong className="text-zinc-100">Transferência internacional:</strong> a hospedagem e o
          banco podem processar dados fora do Brasil (Estados Unidos). A transferência ocorre com
          base no art. 33 da LGPD, apenas para viabilizar o serviço, e as cláusulas contratuais dos
          fornecedores preveem proteção de dados e confidencialidade.
        </p>
      </LegalSection>

      <LegalSection number="5" title="Por quanto tempo guardamos">
        <div className="mt-1 flex flex-col gap-2.5">
          {RETENTION_SUMMARY.map((rule) => (
            <div key={rule.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <p className="text-[12.5px] font-bold text-zinc-100">{rule.label}</p>
              <p className="mt-0.5 text-[12px] text-zinc-300">
                Guardamos por: <strong className="text-zinc-100">{rule.period}</strong>
              </p>
              <p className="text-[11.5px] text-zinc-500">Motivo: {rule.why}</p>
            </div>
          ))}
        </div>
        <p className="mt-3">
          Uma rotina automática de limpeza apaga o que passou desses prazos. Você não precisa pedir
          para que isso aconteça.
        </p>
      </LegalSection>

      <LegalSection number="6" title="Com quem compartilhamos (terceiros)">
        <p>Só usamos os serviços abaixo, e apenas com os dados necessários para cada função:</p>
        <div className="mt-2 flex flex-col gap-2.5">
          {THIRD_PARTIES.map((party) => (
            <div key={party.name} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <p className="text-[12.5px] font-bold text-zinc-100">
                {party.name} — <span className="font-semibold text-zinc-300">{party.role}</span>
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-300">{party.data}</p>
              <p className="text-[11.5px] text-zinc-500">{party.location}</p>
            </div>
          ))}
        </div>
        <p className="mt-3">
          <strong className="text-zinc-100">Não fazemos:</strong> venda de dados, compartilhamento
          com as plataformas de corrida/entrega, uso de cookies de publicidade de terceiros ou
          rastreamento entre sites.
        </p>
        <p>
          Podemos divulgar dados quando houver ordem judicial, requisição de autoridade competente
          ou necessidade de exercer direitos em processo, sempre no limite do pedido.
        </p>
      </LegalSection>

      <LegalSection number="7" title="Seus direitos e como exercê-los">
        <p>
          Você pode, a qualquer momento e sem custo: confirmar a existência de tratamento,
          acessar seus dados, corrigir o que estiver incompleto ou desatualizado, solicitar
          anonimização/bloqueio/eliminação, pedir portabilidade, revogar consentimento e obter
          informação sobre compartilhamentos.
        </p>
        <LegalList
          items={[
            <>
              <strong className="text-zinc-100">Baixar meus dados:</strong> em Configurações ›
              Privacidade e meus dados › “Baixar meus dados” (arquivo JSON com tudo o que está
              vinculado à sua conta).
            </>,
            <>
              <strong className="text-zinc-100">Corrigir meus dados:</strong> edite direto em
              Configurações (veículo, custos, metas), nos lançamentos, ou fale com o suporte para
              corrigir nome/e-mail.
            </>,
            <>
              <strong className="text-zinc-100">Gerenciar cookies:</strong> Configurações ›
              Privacidade › Preferências de cookies.
            </>,
            <>
              <strong className="text-zinc-100">Excluir minha conta:</strong> Configurações ›
              Privacidade e meus dados › “Excluir minha conta”. Apagamos os dados pessoais e
              operacionais; mantemos apenas o registro mínimo de compra quando houver obrigação
              legal ou necessidade de defesa de direitos.
            </>,
            <>
              <strong className="text-zinc-100">Reembolso / arrependimento:</strong> veja{" "}
              <Link
                href="/ajuda/compra-e-reembolso"
                className="font-semibold text-volt-300 underline underline-offset-4"
              >
                Compra e reembolso
              </Link>
              . Isso é diferente de apagar a conta.
            </>,
            <>
              <strong className="text-zinc-100">Reclamação:</strong> você também pode reclamar à
              ANPD (Autoridade Nacional de Proteção de Dados) ou aos órgãos de defesa do consumidor.
            </>,
          ]}
        />
        <p className="mt-2">
          Se preferir, escreva para{" "}
          <a
            href={`mailto:${BUSINESS_INFO.supportEmail}`}
            className="font-semibold text-volt-300 underline underline-offset-4"
          >
            {BUSINESS_INFO.supportEmail}
          </a>{" "}
          com o assunto “Privacidade” e respondemos em até 15 dias.
        </p>
      </LegalSection>

      <LegalSection number="8" title="Segurança da informação">
        <LegalList
          items={[
            "Senhas guardadas apenas como hash (scrypt com salt) — nem nós conseguimos ler sua senha.",
            "Sessões com cookie httpOnly, expiração e encerramento remoto quando necessário.",
            "Tokens de redefinição de senha de uso único, com validade curta e guardados por hash; trocar a senha encerra as sessões antigas.",
            "Acesso administrativo restrito por token, e dados de diagnóstico exibidos de forma mascarada.",
            "Medidas de proteção contra abuso no formulário de contato e nas rotas sensíveis.",
          ]}
        />
        <p>
          Se ocorrer incidente de segurança relevante, comunicamos você e a ANPD conforme o art. 48
          da LGPD.
        </p>
      </LegalSection>

      <LegalSection number="9" title="Menores de idade">
        <p>
          O GiroLucro é destinado a pessoas maiores de 18 anos, que trabalham com transporte ou
          entrega. Não coletamos intencionalmente dados de crianças ou adolescentes.
        </p>
      </LegalSection>

      <LegalSection number="10" title="Alterações desta política">
        <p>
          Esta é a versão {PRIVACY_DOC.version} ({PRIVACY_DOC.versionLabel}). Quando houver mudança
          relevante, publicamos a nova versão aqui e avisamos dentro do app; se a mudança afetar
          suas escolhas, pedimos novo aceite.
        </p>
      </LegalSection>

      <LegalSection number="11" title="Documentos relacionados">
        <LegalList
          items={[
            <>
              <Link href="/termos" className="font-semibold text-volt-300 underline underline-offset-4">
                Termos de Uso
              </Link>
            </>,
            <>
              <Link href="/cookies" className="font-semibold text-volt-300 underline underline-offset-4">
                Política de Cookies
              </Link>
            </>,
            <>
              <Link
                href="/ajuda/compra-e-reembolso"
                className="font-semibold text-volt-300 underline underline-offset-4"
              >
                Ajuda: compra e reembolso
              </Link>
            </>,
          ]}
        />
      </LegalSection>
    </LegalPageShell>
  );
}
