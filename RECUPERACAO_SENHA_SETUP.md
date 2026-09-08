# Recuperação de senha por e-mail — configuração 100% online

O fluxo já está implementado. Para enviar e-mails reais, basta configurar o Resend
pela web — não precisa instalar nada localmente.

## O que já funciona

1. Na tela `/entrar`, o usuário toca em **Esqueci minha senha**
2. Informa o e-mail em `/esqueci-senha`
3. O servidor gera um token aleatório, salva apenas o hash e envia o link por e-mail
4. O link abre `/redefinir-senha?token=...` e vale por **30 minutos**
5. Após criar a nova senha, o link é invalidado e todas as sessões antigas são encerradas

Segurança incluída:

- a tela nunca revela se um e-mail está ou não cadastrado;
- token criptograficamente aleatório de 256 bits;
- somente o SHA-256 do token fica no banco;
- expiração em 30 minutos e uso único;
- limite de 3 solicitações por conta a cada 10 minutos;
- todas as sessões antigas são desconectadas depois da troca.

## 1. Criar a conta no Resend

1. Acesse [resend.com](https://resend.com) e crie a conta
2. Abra **Domains → Add Domain**
3. Informe seu domínio, por exemplo `girolucro.com.br`
4. No painel DNS onde comprou o domínio, copie os registros exibidos pelo Resend
5. Aguarde o status do domínio ficar **Verified**
6. Abra **API Keys → Create API Key** e copie a chave `re_...`

> Durante testes, o Resend permite usar `onboarding@resend.dev`, mas normalmente só
> envia para o e-mail da própria conta. Para clientes reais, verifique seu domínio.

## 2. Configurar na Vercel pelo navegador

Na Vercel, abra seu projeto → **Settings → Environment Variables** e crie:

| Nome | Exemplo |
|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxxx` |
| `EMAIL_FROM` | `GiroLucro <contato@girolucro.com.br>` |
| `APP_URL` | `https://app.girolucro.com.br` |

Selecione **Production, Preview e Development** para `RESEND_API_KEY` e
`EMAIL_FROM`. Em `APP_URL`, use o endereço definitivo de produção.

Depois clique em **Deployments → Redeploy** para carregar as novas variáveis.

## 3. Atualizar o banco sem terminal

Depois de publicar esta versão, abra novamente a rota de setup com seu token:

```text
https://SEU-DOMINIO/api/admin/setup?token=SEU_ADMIN_SETUP_TOKEN
```

Ela criará apenas a nova tabela `password_reset_tokens` e seu índice. As tabelas e
dados existentes não serão apagados.

## 4. Testar

1. Saia da conta
2. Abra `/entrar`
3. Toque em **Esqueci minha senha**
4. Digite um e-mail cadastrado
5. Abra o e-mail recebido e toque em **Criar uma nova senha**
6. Salve uma senha com pelo menos 8 caracteres
7. Entre novamente com a nova senha

## Entregabilidade

Para os e-mails não caírem em Spam:

- verifique os registros SPF e DKIM exibidos pelo Resend;
- use um remetente do seu próprio domínio;
- não use endereço gratuito (`@gmail.com`) em `EMAIL_FROM`;
- mantenha o texto transacional, sem propaganda no e-mail de recuperação.
