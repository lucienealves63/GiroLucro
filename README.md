# GiroLucro

> Seu lucro real na pista. SaaS para motoristas de aplicativo e motoboys
> descobrirem **quanto sobra de verdade** no bolso — não o bruto do app.

![Next.js](https://img.shields.io/badge/Next.js_16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle-336791) ![PWA](https://img.shields.io/badge/PWA-instalável-b8f53c)

## O que o app faz

- **Lucro líquido real** — desconta combustível (estimado por km ou real abastecido),
  provisão de manutenção por km, custos fixos rateados por dia, marmita e emergências
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
  assinaturas mensal/anual (ponto de integração Mercado Pago/Stripe documentado)

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Drizzle ORM · PostgreSQL ·
Framer Motion · Recharts · Lucide

## Rodando localmente

```bash
# 1. clone e instale
git clone https://github.com/SEU_USUARIO/girolucro.git
cd girolucro
npm install

# 2. configure o banco (copie e edite)
cp .env.example .env
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/girolucro"

# 3. crie as tabelas
npx drizzle-kit push

# 4. rode
npm run dev
```

Abra http://localhost:3000 → crie sua conta → carregue os **dados de exemplo**
(botão na tela inicial) para explorar o app completo.

## Deploy (Vercel + Neon)

**Sem instalar nada no computador?** Siga o guia [DEPLOY_ONLINE.md](./DEPLOY_ONLINE.md) —
GitHub, banco, Vercel e criação das tabelas feitos 100% pelo navegador (até do celular).

Com terminal:

1. Crie um banco gratuito em [neon.tech](https://neon.tech) e copie a `DATABASE_URL`
2. Importe este repositório na [Vercel](https://vercel.com) → env vars `DATABASE_URL` e `ADMIN_SETUP_TOKEN` → Deploy
3. Crie as tabelas abrindo um link: `https://SEU-APP.vercel.app/api/admin/setup?token=SEU_TOKEN`
   (ou, se preferir terminal: `DATABASE_URL="<url>" npx drizzle-kit push`)
4. Pronto — HTTPS, domínio `.vercel.app` e deploy automático a cada push

## Pagamentos

A integração recorrente do Mercado Pago está em `src/app/api/billing/`: checkout,
webhook de confirmação e cancelamento. Consulte `MERCADO_PAGO_SETUP.md`.

## Recuperação de senha

O fluxo “Esqueci minha senha” usa tokens com hash, expiração de 30 minutos e envio
pelo Resend. Configure `RESEND_API_KEY`, `EMAIL_FROM` e `APP_URL` na Vercel seguindo
`RECUPERACAO_SENHA_SETUP.md`.
