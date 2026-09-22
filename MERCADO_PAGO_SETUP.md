# Mercado Pago no GiroLucro — configuração 100% online

O GiroLucro Pro é vendido em **pagamento único** (R$ 19,90): **sem assinatura, sem
mensalidade e sem renovação automática**. O app oferece dois caminhos, os dois no
Mercado Pago:

- **Checkout Pro** (cartão, Pix e demais meios da conta) — é o botão principal da
  tela de assinatura;
- **Pix à vista**, com QR Code gerado no próprio app (validade de 60 minutos).

Em qualquer um dos casos o acesso Pro só é liberado **depois** que o Mercado Pago
confirma o pagamento por webhook. O recibo vai por e-mail (quando o Resend está
configurado) e fica disponível em **Configurações → Minha compra**.

> Assinaturas recorrentes (`subscription_preapproval`) continuam sendo processadas
> apenas para contas antigas que já estavam nesse formato. Nenhuma venda nova cria
> recorrência.

> Nunca envie sua senha, código de verificação, Access Token ou assinatura secreta
> por chat. Eles devem ser colados somente nas variáveis protegidas da Vercel.

## 1. Criar uma aplicação no Mercado Pago

1. Entre na sua conta em [mercadopago.com.br/developers](https://www.mercadopago.com.br/developers)
2. Abra **Suas integrações**
3. Clique em **Criar aplicação**
4. Nome: `GiroLucro`
5. Selecione pagamentos online quando essa opção for exibida
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

- **Pagamentos** — tópico `payment` (obrigatório: é ele que libera o Pro, tanto no
  Checkout Pro quanto no Pix, e também avisa estornos e chargebacks)
- **Assinaturas** — `subscription_preapproval` e `subscription_authorized_payment`
  (só são usados por assinaturas antigas; pode deixar ativo sem efeito colateral)

Depois de salvar, o Mercado Pago exibirá uma **assinatura secreta** para validar
`x-signature`. Copie-a e crie na Vercel:

```text
MERCADO_PAGO_WEBHOOK_SECRET=valor_exibido_no_painel
```

O webhook do GiroLucro:

- valida o HMAC SHA-256 de `x-signature`;
- consulta o pagamento diretamente na API oficial (nunca confia no corpo recebido);
- confere usuário, moeda `BRL` e valor (R$ 19,90) antes de liberar;
- é idempotente: reenvio do mesmo evento não libera duas vezes nem gera recibo duplicado;
- trata `refunded` e `charged_back` mantendo o histórico de reembolso em dia.

## 4. Configurar a URL pública

Na Vercel, crie também:

```text
APP_URL=https://SEU-DOMINIO
```

Use o domínio definitivo, sem barra no final. Essa URL é usada no retorno do checkout,
nos links de recuperação de senha e nos e-mails de pós-venda.

## 5. Publicar as variáveis

Depois de criar as variáveis, abra:

**Deployments → último deploy → Redeploy**

Sem o Access Token ou sem a assinatura secreta do webhook, o app não libera o Pro
automaticamente e a tela de assinatura mostra erro de configuração — ele não libera
acesso de graça.

## 6. Atualizar o banco sem terminal

Abra novamente a rota de setup do seu app:

```text
https://SEU-DOMINIO/api/admin/setup?token=SEU_ADMIN_SETUP_TOKEN
```

Ela cria (sem apagar nada) as tabelas `billing_events`, `legal_acceptances` e
`data_subject_requests`, além das colunas de aceite, pagamento, reembolso e exclusão
de conta.

## 7. E-mail de pós-venda (recomendado)

Configure o Resend para o recibo e os avisos:

```env
RESEND_API_KEY="re_..."
EMAIL_FROM="GiroLucro <contato@girolucro.app.br>"
CONTACT_TO_EMAIL="contato@girolucro.app.br"
```

Com isso, cada compra confirmada gera **um** e-mail com valor, data, forma de
pagamento, identificador da transação e o prazo de arrependimento de 7 dias. Quem
ainda não pediu nada recebe também um lembrete 2–3 dias antes do fim do prazo
(`/api/cron/reminders` — veja `PRIVACIDADE_LGPD.md`).

Sem essas variáveis nada quebra: a compra é liberada igual, o recibo continua
disponível no app e os e-mails apenas não saem (o motivo aparece no log e no
diagnóstico).

## 8. Teste recomendado

1. Use primeiro as credenciais de teste da sua aplicação
2. Crie um usuário comprador de teste no painel do Mercado Pago
3. Entre no GiroLucro com uma conta de teste e abra **Assinatura** (tela de compra)
4. Pague pelo **Checkout Pro** (cartão de teste) ou pelo **Pix** (simule a
   confirmação no painel do Mercado Pago em *Atividade*)
5. Confira na Vercel em **Logs**:
   - `POST /api/billing/checkout` → 200
   - `POST /api/billing/webhook?...` → 200
6. Volte ao app: o selo Pro aparece, **Configurações → Minha compra** mostra o
   recibo com o identificador da transação e o prazo até a data limite
7. Peça o reembolso na mesma tela: dentro de 7 dias o estorno é automático pelo
   Mercado Pago e o acesso é encerrado
8. Confira `/admin?aba=pedidos&token=SEU_TOKEN`: reembolsos fora do prazo, pagamentos
   não-Mercado Pago ou pedidos feitos antes das credenciais entrarem ficam na **fila
   manual** para você resolver e marcar como *reembolso feito* / *recusar*

Não use a mesma conta vendedora como compradora nos testes.

## 9. Reembolso (direito de arrependimento)

- Dentro de 7 dias corridos, com o Mercado Pago configurado, o app chama
  `POST /v1/payments/{id}/refunds` com `X-Idempotency-Key` — o estorno é automático.
- Fora do prazo, pagamento não-Mercado Pago ou provedor indisponível: o pedido entra
  na fila manual do painel (`/admin?aba=pedidos`), com o identificador da transação
  para você reembolsar no painel do provedor.
- Marcar **reembolso feito** encerra o acesso Pro, grava a data e envia o e-mail de
  confirmação; **recusar** também avisa a pessoa e mantém o acesso ativo.
- Estorno ou chargeback avisados pelo Mercado Pago atualizam o status sozinhos.

## 10. Produção

Quando o teste estiver aprovado:

1. mantenha `MERCADO_PAGO_ACCESS_TOKEN` com a credencial de produção;
2. confira que a URL de webhook é o domínio de produção;
3. faça uma compra real de baixo risco com uma conta compradora diferente;
4. valide: liberação automática, recibo por e-mail, selo Pro, reembolso dentro do
   prazo e o registro correto na aba **Pedidos** do painel.

## 11. Diagnóstico do pagamento

Abra no navegador:

```text
https://SEU-DOMINIO/api/admin/billing-status?token=SEU_ADMIN_SETUP_TOKEN
```

A página (visual idêntico ao diagnóstico de e-mail) verifica:

1. `MERCADO_PAGO_ACCESS_TOKEN` está presente e se usa `APP_USR-` (produção),
   `TEST-` (só teste) ou outro formato (ex.: Public Key).
2. O Access Token é aceito pelo Mercado Pago (`GET /users/me`).
3. `MERCADO_PAGO_WEBHOOK_SECRET` está presente.
4. `APP_URL` resolvida e sua origem.
5. A tabela `billing_events` existe no banco.

Para JSON, adicione `&format=json` ao final da URL.

## Variáveis finais

```env
APP_URL="https://app.girolucro.com.br"
MERCADO_PAGO_ACCESS_TOKEN="APP_USR-..."
MERCADO_PAGO_WEBHOOK_SECRET="..."
RESEND_API_KEY="re_..."
EMAIL_FROM="GiroLucro <contato@girolucro.app.br>"
CRON_SECRET="token-do-cron"
BILLING_DEMO_MODE=false
```

`BILLING_DEMO_MODE=true` funciona somente fora de produção e precisa ser habilitado
explicitamente. Na Vercel, deixe ausente ou `false`.
