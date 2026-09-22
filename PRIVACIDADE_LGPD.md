# Privacidade, LGPD e cookies — guia do que está implementado

> Documento **interno** (não é a política pública). A versão pública está em
> `/privacidade`, `/termos`, `/cookies` e `/ajuda/compra-e-reembolso`, geradas a partir
> de `src/lib/legal.ts` + `src/lib/business-info.ts`.
>
> **Antes de publicar/divulgar**, revise a seção “Pendências de negócio” no fim do arquivo.

## 1. Por onde começar

| Assunto | Arquivo |
| --- | --- |
| Versões e prazos dos documentos | `src/lib/legal.ts` |
| Identificação do fornecedor (CNPJ, endereço, e-mail) | `src/lib/business-info.ts` |
| Consentimento de cookies (cliente) | `src/lib/cookie-consent.ts` + `src/components/cookie-consent.tsx` |
| Medição de visitas (gate de consentimento) | `src/components/visit-tracker.tsx` + `src/app/api/visit/route.ts` |
| Aceites e histórico | `src/lib/legal-acceptance.ts` + tabela `legal_acceptances` |
| Exportar / excluir dados | `src/lib/account.ts` + `src/app/api/account/*` |
| Reembolso (art. 49 do CDC) | `src/app/api/billing/refund/route.ts` |
| Retenção e limpeza automática | `src/lib/retention.ts` + `src/app/api/cron/retention/route.ts` |

## 2. Mapa de dados

| Dado | Onde fica | Para que serve | Retenção |
| --- | --- | --- | --- |
| Nome, e-mail, senha (hash scrypt) | `users`, `sessions` | Conta, login, comunicação | Enquanto a conta existir; sessões expiradas saem em 30 dias |
| Aceite dos documentos (versão + data) | `users.*_version/accepted_at`, `legal_acceptances` | Comprovar consentimento | Enquanto a conta existir |
| Registros de trabalho, despesas, manutenções, configurações | `work_entries`, `expenses`, `maintenances`, `settings` | O cálculo do lucro é o produto | Enquanto a conta existir |
| Compra (id do pagamento, valor, status, reembolso) | `users.payment_*`, `billing_events` | Entrega do Pro, recibo, obrigações fiscais | 5 anos |
| Mensagens do formulário de contato | `contact_messages` | Atendimento e defesa de direitos | 2 anos (1 ano quando já respondida/arquivada) |
| Visitas (identificador `gl_vid`, caminho, canal, dispositivo) | `page_views`, cookie `gl_vid` | Saber o que funciona no app (painel do dono) | 1 ano — **só com consentimento** |
| Inscrições de push | `push_subscriptions` | Lembretes e avisos pedidos pelo usuário | Até desativar/perder a conta |
| Histórico de notificações | `notification_logs` | Evitar repetir aviso e auditar envio | 6 meses |
| Tokens de recuperação de senha | `password_reset_tokens` | Recuperar acesso | 30 dias |

Retenção implementada em `src/lib/retention.ts` (`RETENTION`) e aplicada pela rotina
`runRetentionCleanup()`. Os mesmos prazos aparecem na política pública
(`RETENTION_SUMMARY`) — **mudou aqui, muda lá**.

## 3. Fluxos do titular (LGPD)

Todos ficam em **Configurações → Privacidade e meus dados** (`src/components/privacy-data.tsx`).

| Direito | O que acontece | Endpoint |
| --- | --- | --- |
| Acessar/portar | Baixa um JSON com conta, configurações, lançamentos, despesas, manutenções, mensagens, assinaturas de push, visitas e pedidos | `GET /api/account/export` |
| Corrigir | Formulário de contato com o assunto “Privacidade/LGPD” | `/contato` |
| Revogar consentimento | Painel de cookies (“Gerenciar cookies”): voltar para “Somente necessários” apaga `gl_vid`/`gl_sid` | `CookiePreferencesButton` |
| Excluir conta | Confirmação digitando `EXCLUIR`; apaga os dados pessoais e, quando existe compra, mantém apenas o registro mínimo exigido (anonimizado) | `DELETE /api/account` |
| Reembolso | Pedido com registro e resposta por e-mail | `POST /api/billing/refund` |

Cada solicitação atendida gera uma linha em `data_subject_requests` (`logDataSubjectRequest`),
sem copiar os dados pessoais do pedido — serve para provar que o pedido foi atendido.

## 4. Cookies e medição

- **Necessários**: `gl_session` (login), `gl_consent` (esta escolha) e `gl_theme` (tema,
  no localStorage).
- **Analytics (opcional)**: o cookie `gl_vid`, o `gl_sid` (memória da aba) e o registro em `page_views` só existem
  **depois** de “Aceitar analytics”. Sem consentimento, `/api/visit` responde `204` e
  não grava nada (nem cria cookie).
- O medidor é de **primeiro domínio** (sem Google Analytics, sem cookie de terceiros) e
  ignora requisições de bots conhecidos (`src/lib/analytics.ts`).
- Quem já usava o app antes desta mudança mantém o opt-out antigo (`localStorage.gl_analytics_off`).

## 5. Rotina de limpeza

```bash
# Executa a limpeza uma vez (o mesmo endpoint pode ser chamado por um cron)
curl "https://SEU-APP.vercel.app/api/cron/retention?token=$CRON_SECRET"
```

- Em produção, agende 1x por dia (Vercel Cron ou cron-job.org) apontando para
  `/api/cron/retention` com o `CRON_SECRET` (ou `ADMIN_SETUP_TOKEN`).
- A resposta é um relatório com o que foi apagado (`deleted.*`).
- Um agendador interno (`src/lib/notification-cron.ts`) roda a limpeza às 03:00
  (horário de Brasília) quando o processo está em produção ou com `RUN_CRON_LOCAL=true`.

## 6. Terceiros usados

| Terceiro | Papel | Dados envolvidos |
| --- | --- | --- |
| Vercel | hospedagem do app | logs de acesso e IP |
| Neon (Postgres gerenciado) | banco de dados | todos os dados da tabela acima |
| Mercado Pago | pagamento e reembolso | nome, e-mail, valor e status da transação |
| Resend | e-mails transacionais | nome, e-mail e conteúdo do e-mail |
| Serviço de push do navegador | entrega de notificações | endpoint e chaves da inscrição |

Transferência internacional: os provedores acima processam dados fora do Brasil; a
política pública informa isso e a base legal usada (execução de contrato, cumprimento
de obrigação legal e legítimo interesse — sempre com o mínimo necessário).

## 7. Segurança já aplicada

- Senhas com **scrypt** + salt (`src/lib/auth.ts`), nunca em texto puro.
- Sessões em cookie `httpOnly`, `SameSite=Lax` e `Secure` em produção.
- `/admin` e o setup de banco protegidos por token; webhook do Mercado Pago com
  verificação de assinatura (`src/lib/mercado-pago.ts`).
- Rotas sensíveis exigem sessão e confirmam a titularidade do dado (export, exclusão,
  reembolso, push) — nenhuma delas aceita identificador de outro usuário.
- Segredos só em variáveis de ambiente (`.env` fica fora do Git).
- Medição e e-mail não guardam conteúdo de terceiros além do necessário.

## 8. Pendências de negócio (bloqueiam publicação “limpa”)

1. **Identificação do fornecedor** — preencher `legalName`, `document` (CNPJ/CPF) e
   `commercialAddress` em `src/lib/business-info.ts`. Enquanto estiverem vazios, o
   rodapé e o checkout exibem um aviso de “em atualização” (nunca inventamos CNPJ).
2. **Encarregado/DPO** — definir e-mail dedicado a privacidade (hoje: `contato@girolucro.app.br`).
3. **Revisão jurídica** dos textos de `/termos`, `/privacidade`, `/cookies` e
   `/ajuda/compra-e-reembolso` por advogado(a) antes de campanha paga.
4. **Maiores de 18 anos** — Termos definem idade mínima; avaliar verificação se o
   produto passar a ter uso por menores.
5. **Publicidade** — não prometer ganhos: os textos usam avisos de simulação
   (`SIMULATION_NOTICE`) e a prova social só publica número aprovado
   (`SOCIAL_PROOF.approvedUsersCount`, hoje `null`).
6. **Registro de acesso** — se a operação exigir, avaliar log de acesso a dados
   pessoais (hoje há log de erros do servidor apenas).
7. **Pós-venda (roadmap, ainda não implementado)** — aviso de compra aprovada,
   e-mail de recibo, lembrete antes do fim dos 7 dias de arrependimento, pedido de
   avaliação e régua de reembolso automatizada por e-mail.

> Ao alterar qualquer texto jurídico, atualize `TERMS_VERSION`/`PRIVACY_VERSION` em
> `src/lib/legal.ts`: o app passa a registrar o novo aceite e a avisar quem aceitou
> a versão antiga.
