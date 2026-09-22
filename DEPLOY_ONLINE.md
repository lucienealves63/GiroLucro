# Deploy 100% Online — sem instalar nada no computador

Este guia coloca o GiroLucro no ar usando **só o navegador** (funciona até do celular).
Tempo total: ~20 minutos. Custo: R$ 0 (free tiers).

## Passo 1 — Baixar e subir o código no GitHub (só pela web)

1. Baixe o arquivo `girolucro.zip` que você recebeu
2. Descompacte (no PC: botão direito → Extrair; no celular Android/iOS: gerenciador de arquivos extrai)
3. Acesse [github.com/new](https://github.com/new) → nome do repo: `girolucro` → **Private**
   - ⚠️ **NÃO marque** nenhuma caixinha (sem README, sem .gitignore) → **Create repository**
4. Na página do repositório criado, clique no link **"uploading an existing file"**
5. Arraste **todos os arquivos e pastas** que você extraiu do zip para a página
   (o GitHub aceita pastas inteiras arrastadas)
   - Não se preocupe: pastas ocultas como `.git` não são enviadas — está tudo certo
6. No final da página, clique em **"Commit changes"**

Pronto — código no GitHub sem nunca abrir um terminal.

## Passo 2 — Criar o banco de dados (Neon, pela web)

1. Acesse [neon.tech](https://neon.tech) → **Sign up** (pode entrar com a conta do GitHub)
2. **New Project** → nome: `girolucro` → região: **São Paulo** (sa-east-1, se disponível) → **Create**
3. Na tela do projeto, copie a **Connection String** (começa com `postgresql://`)
   - Guarde-a — você vai colar na Vercel no próximo passo

## Passo 3 — Deploy na Vercel (pela web)

1. Acesse [vercel.com/signup](https://vercel.com/signup) → entre com a **conta do GitHub**
2. Clique **"Add New → Project"** → encontre `girolucro` → **Import**
3. Antes do deploy, abra **"Environment Variables"** e adicione:

   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | (cole a connection string do Neon) |
   | `ADMIN_SETUP_TOKEN` | (senha que você inventar, ex: `meu-sitio-123`) |

   > Para o produto completo, adicione depois:
   > `APP_URL` (endereço definitivo do app — usado no retorno do checkout e nos e-mails),
   > `MERCADO_PAGO_ACCESS_TOKEN` + `MERCADO_PAGO_WEBHOOK_SECRET` (compra do Pro:
   > pagamento único de R$ 19,90 por Pix ou cartão),
   > `RESEND_API_KEY`, `EMAIL_FROM` e `CONTACT_TO_EMAIL` (recuperação de senha,
   > recibo da compra e formulário de contato),
   > `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (push notifications),
   > `CRON_SECRET` (rotinas de limpeza de dados e lembretes de reembolso).
   >
   > O passo a passo de cada uma está em `MERCADO_PAGO_SETUP.md`,
   > `RECUPERACAO_SENHA_SETUP.md`, `PUSH_NOTIFICATIONS_SETUP.md` e
   > `PRIVACIDADE_LGPD.md`. Todas também estão listadas em `.env.example`.

4. Clique **"Deploy"** → aguarde ~1 minuto → site no ar em `https://girolucro-xxxx.vercel.app`

## Passo 4 — Criar as tabelas (automático!)

Quando o código é publicado, o app **cria/atualiza as tabelas do banco
sozinho** — no primeiro acesso depois de cada deploy, ele aplica automaticamente
tudo o que o novo código trouxe (tabelas, colunas ou índices novos).
Nada de `npm`, nada de `drizzle-kit`, nada de abrir link.

Quer conferir, ou forçar uma reexecução? Abra no navegador:

```
https://girolucro-xxxx.vercel.app/api/admin/setup?token=meu-sitio-123
```

(use o token que você definiu em `ADMIN_SETUP_TOKEN`)

Você verá uma tela bonita listando cada tabela criada, incluindo
`page_views` (visitas), `contact_messages` (contato), `legal_acceptances`
(histórico de aceite dos Termos e da Privacidade) e `data_subject_requests`
(solicitações de titular) → clique em **"Criar minha conta de administrador"**.

> 🔁 O link é **idempotente**: pode rodar quantas vezes quiser — ele só cria o
> que falta e mostra o que já existe. Serve principalmente como diagnóstico
> caso algo pareça fora do normal.

## Passo 5 — Sua conta e pronto!

1. Crie sua conta no app (ganha 7 dias de trial)
2. Toque em **"Explorar com dados de exemplo"** para ver tudo funcionando
3. Compre seu domínio no Registro.br e conecte em **Settings → Domains** na Vercel

## Atualizações futuras (sem terminal de novo)

Quando quiser mudar o app:
- Edite qualquer arquivo **direto no GitHub** (ícone de lápis em cima do arquivo) → Commit
- A Vercel **republica automaticamente** a cada alteração
- Se o código trouxer **tabelas/colunas novas no banco**, elas também são
  aplicadas **automaticamente** no primeiro acesso depois do deploy

## Passo 6 — Painel de acessos e contato (opcional, 1 minuto)

1. Abra `https://girolucro-xxxx.vercel.app/admin?token=meu-sitio-123`
   → é o painel de acessos, desempenho das visitas, assinantes e mensagens
2. Quer ver o painel funcionando na hora, sem esperar tráfego? Abra
   `https://girolucro-xxxx.vercel.app/api/admin/demo-visits?token=meu-sitio-123`
   e depois `...?token=meu-sitio-123&action=clear` para limpar a demonstração
3. O formulário público fica em `https://girolucro-xxxx.vercel.app/contato`
   (as mensagens aparecem na aba **Contato** do painel; e-mail de cópia é opcional)

Detalhes em [PAINEL_ACESSOS.md](./PAINEL_ACESSOS.md).

## Segurança — lembre-se

- Mude `ADMIN_SETUP_TOKEN` para algo só seu (sem isso, qualquer pessoa pode
  executar o setup e **ler o painel `/admin`** — visitas, cadastros e mensagens)
- Enquanto pagamentos estiverem sem `MERCADO_PAGO_ACCESS_TOKEN`, o checkout em
  produção retorna **erro 503** (billing não configurado) — ele **não** ativa o
  plano demo grátis no deploy online. Configure o token do MP antes de abrir as
  vendas de verdade.
