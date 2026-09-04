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

1. Crie um banco gratuito em [neon.tech](https://neon.tech) e copie a `DATABASE_URL`
2. Importe este repositório na [Vercel](https://vercel.com) → env var `DATABASE_URL` → Deploy
3. Rode uma vez local: `DATABASE_URL="<url-do-neon>" npx drizzle-kit push`
4. Pronto — HTTPS, domínio `.vercel.app` e deploy automático a cada push

## Pagamentos

A rota `src/app/api/billing/checkout/route.ts` contém o contrato completo do
ponto de integração (Mercado Pago ou Stripe): criar preferência → webhook confirma →
ativa o plano. O modelo de cobrança (trial 7 dias → paywall → R$ 19,90/mês ou
R$ 149,90/ano) já está implementado e testado.
