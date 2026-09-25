# GiroLucro

> Seu lucro real na pista. SaaS para motoristas de aplicativo e motoboys
> descobrirem **quanto sobra de verdade** no bolso — não o bruto do app.

![Next.js](https://img.shields.io/badge/Next.js_16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle-336791) ![PWA](https://img.shields.io/badge/PWA-instalável-b8f53c)

## O que o app faz

- **Lucro líquido real** — desconta combustível (estimado por km ou real abastecido),
  provisão de manutenção por km, custos fixos rateados por dia, marmita e emergências
- **Combustível por posto** (`/postos`) — lance posto, litros e odômetro em cada
  abastecimento e veja **qual posto deixa mais lucro líquido**: R$/litro, km/l medido
  por posto e o ranking por **R$/km** (R$/litro ÷ km/l), com quanto cada posto tirou do
  seu lucro no período e a projeção mensal dessa diferença
- **Comparativo de plataformas** — Uber × 99 × iFood × Rappi × entregas diretas:
  R$ líquido por hora, por km e **por entrega**, com custo rateado proporcionalmente
- **Tempo de espera** — quanto você perde "mofando" em restaurante e quanto renderia sem isso
- **Controle de repasses** — quanto cada app ainda te deve vs. o que já caiu na conta
- **Oficina** — alertas de manutenção por km (óleo, freios, relação, pneus, revisão)
  e caixinha da oficina (provisionado × gasto real)
- **Metas & reserva** — meta mensal quebrada em meta diária, calendário do ritmo,
  fundo de dias fracos e provisão de férias
- **Calculadora "vale a pena?"** — julga uma corrida/entrega pela sua média real
- **SaaS completo** — cadastro/login (scrypt + sessões), trial de 7 dias, paywall e
  compra em **pagamento único** (Pix/Checkout Mercado Pago), sem mensalidade e sem
  renovação automática
- **Painel do dono** (`/admin`) — acessos, desempenho das visitas, assinantes/conversão
  e a caixa de entrada do `/contato`. Medição própria, sem Google Analytics, sem
  cookie de terceiros → [PAINEL_ACESSOS.md](./PAINEL_ACESSOS.md)
- **Contas de teste** — a conta administrativa (e qualquer conta marcada no painel)
  tem o **Pro liberado sem cobrança** e fica **fora das estatísticas** de cadastros,
  conversão, pagantes e receita; nenhum checkout/Pix é aberto e os avisos de
  cobrança não são enviados → [PAINEL_ACESSOS.md](./PAINEL_ACESSOS.md#8-contas-de-teste-acesso-liberado-fora-dos-números)

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Drizzle ORM · PostgreSQL ·
Framer Motion · Recharts · Lucide

## Rodando localmente

```bash
# 1. clone e instale
git clone https://github.com/SEU_USUARIO/girolucro.git
cd girolucro
npm install

# 2. configure o banco e os segredos (copie e edite)
cp .env.example .env
# DATABASE_URL, ADMIN_SETUP_TOKEN, APP_URL… (todas as variáveis estão no arquivo)

# 3. crie as tabelas
npx drizzle-kit push

# 4. rode
npm run dev
```

Abra http://localhost:3000 → crie sua conta → carregue os **dados de exemplo**
(botão na tela inicial) para explorar o app completo.

### Verificações

```bash
npm run typecheck   # TypeScript estrito
npm run lint        # ESLint
npm test            # Jest — não precisa de banco: os testes sobem um
                    # Postgres em memória (pg-mem) com o schema real do app
```

`npm run build` baixa as fontes do Google (`next/font`); sem internet na máquina
essa etapa falha antes de compilar as páginas.

## Deploy (Vercel + Neon)

**Sem instalar nada no computador?** Siga o guia [DEPLOY_ONLINE.md](./DEPLOY_ONLINE.md) —
GitHub, banco, Vercel e criação das tabelas feitos 100% pelo navegador (até do celular).

Com terminal:

1. Crie um banco gratuito em [neon.tech](https://neon.tech) e copie a `DATABASE_URL`
2. Importe este repositório na [Vercel](https://vercel.com) → env vars `DATABASE_URL` e `ADMIN_SETUP_TOKEN` → Deploy
3. Crie as tabelas abrindo um link: `https://SEU-APP.vercel.app/api/admin/setup?token=SEU_TOKEN`
   (ou, se preferir terminal: `DATABASE_URL="<url>" npx drizzle-kit push`)
4. Pronto — HTTPS, domínio `.vercel.app` e deploy automático a cada push

> Opcional: agende uma vez por dia
> `https://SEU-APP.vercel.app/api/cron/retention?token=SEU_CRON_SECRET` (limpeza por
> tempo de retenção) e `.../api/cron/reminders?token=SEU_CRON_SECRET` (lembretes de
> pós-venda). O agendador interno do app já roda as duas rotinas quando está em
> produção; veja `PRIVACIDADE_LGPD.md`.

## Painel de acessos, pagantes e contato

- `/admin` → abas **Acessos**, **Desempenho das visitas**, **Pagantes**, **Pedidos**
  (fila de reembolso + solicitações de titular), **Contato**, **Diagnóstico**
  (protegido pelo mesmo `ADMIN_SETUP_TOKEN` do setup)
- `/contato` → formulário público; a mensagem é salva no banco e, se houver
  `RESEND_API_KEY`, vira cópia por e-mail
- depois de publicar este código, abra **uma vez** `/api/admin/setup?token=SEU_TOKEN`
  para criar as tabelas `page_views` e `contact_messages`
- guia completo: [PAINEL_ACESSOS.md](./PAINEL_ACESSOS.md)

## Pagamentos

O GiroLucro Pro é vendido em **pagamento único** (R$ 19,90), sem recorrência.
`src/app/api/billing/` tem: checkout (Checkout Pro), Pix, webhook de confirmação e
reembolso (`POST /api/billing/refund`, direito de arrependimento do art. 49 do CDC).
A rota antiga `/api/billing/cancel` continua existindo apenas para cancelar assinaturas
recorrentes legadas — para compras novas ela responde que não existe assinatura.
Consulte `MERCADO_PAGO_SETUP.md`.

## Privacidade, cookies e LGPD

- Páginas públicas: `/privacidade`, `/termos`, `/cookies` e
  `/ajuda/compra-e-reembolso`, com versão e data de vigência (`src/lib/legal.ts`).
- Banner de cookies com “Aceitar analytics” / “Somente necessários”; sem consentimento
  o medidor de visitas não cria identificador e `/api/visit` responde `204`.
- **Configurações → Privacidade e meus dados**: baixar os dados (JSON), corrigir,
  gerenciar cookies e excluir a conta (com confirmação digitada).
- **Configurações → Minha compra**: recibo, identificador da transação e pedido de
  reembolso (automático quando o Mercado Pago está configurado; caso contrário entra
  numa fila de análise manual).
- Limpeza automática por prazo de retenção em `/api/cron/retention?token=...`
  (ver `PRIVACIDADE_LGPD.md`).
- **Pós-venda por e-mail** (Resend opcional): recibo com o identificador da
  transação e o prazo de arrependimento quando a compra é confirmada, e um
  lembrete 2–3 dias antes do fim do prazo em `/api/cron/reminders?token=...`
  (use `&dry=1` para conferir a lista sem enviar).

## Recuperação de senha

O fluxo “Esqueci minha senha” usa tokens com hash, expiração de 30 minutos e envio
pelo Resend. Configure `RESEND_API_KEY`, `EMAIL_FROM` e `APP_URL` na Vercel seguindo
`RECUPERACAO_SENHA_SETUP.md`.
