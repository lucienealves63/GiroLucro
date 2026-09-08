# Mercado Pago no GiroLucro — configuração 100% online

A integração usa **Assinaturas sem plano associado**. O app cria a recorrência mensal
ou anual, envia o cliente para o checkout hospedado pelo Mercado Pago e só libera o
Pro depois que uma cobrança aprovada é confirmada por webhook.

> Nunca envie sua senha, código de verificação, Access Token ou assinatura secreta
> por chat. Eles devem ser colados somente nas variáveis protegidas da Vercel.

## 1. Criar uma aplicação no Mercado Pago

1. Entre na sua conta em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers)
2. Abra **Suas integrações**
3. Clique em **Criar aplicação**
4. Nome: `GiroLucro`
5. Selecione pagamentos online/assinaturas quando essa opção for exibida
6. Abra a aplicação criada

O e-mail usado para entrar no Mercado Pago não é cadastrado no código. A aplicação
fica vinculada à sua conta de vendedor diretamente no painel.

## 2. Obter o Access Token

Na aplicação, abra **Credenciais de produção** e copie o **Access Token**, normalmente
iniciado por `APP_USR-`.

Na Vercel:

1. Projeto GiroLucro → **Settings → Environment Variables**
2. Crie `MERCADO_PAGO_ACCESS_TOKEN`
3. Cole o Access Token como valor
4. Marque o ambiente **Production**

Não use Public Key nessa variável e não adicione `NEXT_PUBLIC_` ao nome.

## 3. Configurar o webhook

Na aplicação do Mercado Pago, abra **Webhooks/Notificações** e cadastre:

```text
https://SEU-DOMINIO/api/billing/webhook
```

Ative estes eventos:

- **Assinaturas** — tópico `subscription_preapproval`
- **Pagamentos recorrentes de assinatura** — `subscription_authorized_payment`
- **Pagamentos** — tópico `payment`

Depois de salvar, o Mercado Pago exibirá uma **assinatura secreta** para validar
`x-signature`. Copie-a e crie na Vercel:

```text
MERCADO_PAGO_WEBHOOK_SECRET=valor_exibido_no_painel
```

O webhook do GiroLucro:

- valida o HMAC SHA-256 de `x-signature`;
- consulta a assinatura/fatura diretamente na API oficial;
- confere usuário, e-mail, moeda, preço e periodicidade;
- só ativa o Pro quando a cobrança está `approved`;
- é idempotente: reenvios não estendem o plano duas vezes;
- processa cancelamentos sem cortar o período já pago.

## 4. Configurar a URL pública

Na Vercel, crie também:

```text
APP_URL=https://SEU-DOMINIO
```

Use o domínio definitivo, sem barra no final. Essa URL é usada no retorno do checkout
e nos links de recuperação de senha.

## 5. Publicar as variáveis

Depois de criar as três variáveis, abra:

**Deployments → último deploy → Redeploy**

Sem o Access Token ou sem a assinatura do webhook, o app não libera planos
automaticamente e retorna erro de configuração — ele não oferece assinatura grátis.

## 6. Atualizar o banco sem terminal

Abra novamente a rota de setup do seu app:

```text
https://SEU-DOMINIO/api/admin/setup?token=SEU_ADMIN_SETUP_TOKEN
```

Ela criará a tabela `billing_events`, usada para impedir processamento duplicado.
Nenhum usuário ou lançamento existente será apagado.

## 7. Teste recomendado

1. Use primeiro as credenciais de teste da sua aplicação
2. Crie um usuário comprador de teste no painel do Mercado Pago
3. Entre no GiroLucro com uma conta de teste
4. Abra **Assinatura**, escolha Mensal ou Anual e continue para o checkout
5. Finalize com os dados de comprador/cartão fornecidos pelo próprio Mercado Pago
6. Confira na Vercel em **Logs**:
   - `POST /api/billing/checkout` → 200
   - `POST /api/billing/webhook?...` → 200
7. Volte ao app e confirme o selo Pro e a data de validade

Não use a mesma conta vendedora como compradora nos testes.

## 8. Produção

Quando o teste estiver aprovado:

1. mantenha `MERCADO_PAGO_ACCESS_TOKEN` com a credencial de produção;
2. confira que a URL de webhook é o domínio de produção;
3. faça uma compra real de baixo risco com uma conta compradora diferente;
4. valide cobrança, cancelamento e acesso até o fim do período.

## Variáveis finais

```env
APP_URL="https://app.girolucro.com.br"
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-..."
MERCADO_PAGO_WEBHOOK_SECRET="..."
BILLING_DEMO_MODE=false
```

`BILLING_DEMO_MODE=true` funciona somente fora de produção e precisa ser habilitado
explicitamente. Na Vercel, deixe ausente ou `false`.
