import type { Metadata } from "next";
import Link from "next/link";
import { LegalList, LegalPageShell, LegalSection } from "@/components/legal-page";
import { CookiePreferencesButton } from "@/components/cookie-preferences-button";
import { COOKIES_DOC } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de Cookies — GiroLucro",
  description:
    "Quais cookies o GiroLucro usa, para quê, por quanto tempo e como mudar sua escolha a qualquer momento.",
  robots: { index: true, follow: true },
};

const COOKIES = [
  {
    name: "gl_session",
    type: "Necessário",
    purpose: "Mantém você logado com segurança (cookie httpOnly, inacessível ao JavaScript da página).",
    duration: "30 dias",
  },
  {
    name: "gl_consent",
    type: "Necessário",
    purpose: "Guarda a sua escolha sobre cookies para não perguntar de novo a cada visita.",
    duration: "180 dias",
  },
  {
    name: "gl_theme (armazenamento local)",
    type: "Necessário",
    purpose: "Lembra se você prefere o tema escuro ou claro. Fica no seu aparelho.",
    duration: "até você limpar o navegador",
  },
  {
    name: "gl_vid",
    type: "Analytics (opcional)",
    purpose:
      "Identificador de visitante de primeiro domínio, criado só depois do seu “Aceitar analytics”. Serve para contar pessoas diferentes sem usar IP nem cookies de terceiros.",
    duration: "1 ano",
  },
  {
    name: "gl_sid (memória da aba)",
    type: "Analytics (opcional)",
    purpose: "Distingue cada visita/aba para medir páginas por visita e tempo médio na tela.",
    duration: "enquanto a aba estiver aberta",
  },
];

export default function CookiesPage() {
  return (
    <LegalPageShell
      doc={COOKIES_DOC}
      intro={
        <p>
          O GiroLucro não usa cookies de publicidade nem rastreadores de terceiros. Usamos cookies
          necessários para o app funcionar e, apenas com a sua autorização, tecnologias de medição
          de uso (analytics).
        </p>
      }
    >
      <LegalSection number="1" title="O que são cookies e tecnologias parecidas">
        <p>
          Cookies são pequenos arquivos gravados no seu navegador. Também usamos armazenamento local
          e de sessão do navegador para guardar preferências e identificadores de medição. Todos os
          identificadores do GiroLucro são de primeiro domínio (do próprio girolucro.app.br) — não
          usamos serviços de rastreamento entre sites.
        </p>
      </LegalSection>

      <LegalSection number="2" title="Cookies e identificadores que usamos">
        <div className="flex flex-col gap-2.5">
          {COOKIES.map((cookie) => (
            <div key={cookie.name} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <p className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[11.5px] font-semibold text-zinc-100">
                  {cookie.name}
                </code>
                <span
                  className={
                    cookie.type === "Necessário"
                      ? "rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10.5px] font-bold text-emerald-300"
                      : "rounded-full bg-amber-400/15 px-2 py-0.5 text-[10.5px] font-bold text-amber-300"
                  }
                >
                  {cookie.type}
                </span>
                <span className="text-[11px] text-zinc-500">Duração: {cookie.duration}</span>
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-300">{cookie.purpose}</p>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection number="3" title="Analytics só com consentimento">
        <LegalList
          items={[
            "Enquanto você não escolhe nada, nenhuma medição é feita: o GiroLucro não cria o identificador de visitante nem envia eventos.",
            "Escolhendo “Somente necessários”, o app continua 100% funcional, sem medição opcional — e qualquer identificador já criado é apagado do seu navegador.",
            "Escolhendo “Aceitar analytics”, passamos a registrar visitas de forma agregada (página, origem, dispositivo e tempo na tela), sem IP e sem dados da sua conta além do vínculo de que aquela sessão está logada.",
            "Você pode mudar a escolha a qualquer momento. Ao revogar, paramos a medição imediatamente e apagamos o identificador.",
          ]}
        />
      </LegalSection>

      <LegalSection number="4" title="Notificações push">
        <p>
          As notificações não usam cookies: dependem de uma inscrição criada pelo seu navegador,
          que só existe depois que você autoriza. Você pode desativar em Configurações ›
          Notificações ou nas permissões do navegador — ao desativar, nossa inscrição é removida do
          servidor.
        </p>
      </LegalSection>

      <LegalSection number="5" title="Como mudar sua escolha agora">
        <p>
          Use o botão abaixo (ou o rodapé de qualquer página) para reabrir o painel de preferências.
        </p>
        <CookiePreferencesButton />
        <p className="mt-2 text-[12.5px] text-zinc-400">
          Você também pode apagar cookies pelas configurações do seu navegador. Os cookies
          necessários serão recriados quando você voltar a usar o app — sem eles, o login não
          funciona.
        </p>
      </LegalSection>

      <LegalSection number="6" title="Mais informações">
        <LegalList
          items={[
            <>
              <Link href="/privacidade" className="font-semibold text-volt-300 underline underline-offset-4">
                Política de Privacidade
              </Link>{" "}
              — dados pessoais, prazos de retenção e direitos do titular.
            </>,
            <>
              <Link href="/termos" className="font-semibold text-volt-300 underline underline-offset-4">
                Termos de Uso
              </Link>{" "}
              — regras de contratação e uso do aplicativo.
            </>,
          ]}
        />
      </LegalSection>
    </LegalPageShell>
  );
}
