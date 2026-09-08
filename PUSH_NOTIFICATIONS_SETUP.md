# Push Notifications (Web Push API) — GiroLucro

## O que é?

O app agora envia lembretes automáticos para o celular do motorista:
- ⚠️ **Manutenção urgente/vencida** — quando o óleo/freios estão para vencer
- 🔴 **Trial expirando** — nos últimos 2 dias antes de encerrar
- 📊 **Meta diária** — todos os dias às 08h, lembrando o objetivo do dia

## 1. Gerar chaves VAPID

As chaves VAPID autenticam seu servidor com o serviço de push (Google Cloud, Apple, Mozilla).

Execute **uma única vez** no seu computador:

```bash
node -e "const wp = require('web-push'); const k = wp.generateVAPIDKeys(); console.log('PUBLIC:', k.publicKey); console.log('PRIVATE:', k.privateKey);"
```

Você receberá:
```
PUBLIC: BEi5...xyz (string longa)
PRIVATE: 2aB1...abc (string muito longa)
```

## 2. Guardar no .env

```env
# Chaves VAPID para Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BEi5...xyz
VAPID_PRIVATE_KEY=2aB1...abc
VAPID_SUBJECT=mailto:seu-email@girolucro.app
```

**Nunca commitar a PRIVATE_KEY no git!** Ela está no `.gitignore`.

## 3. Deploy na Vercel

1. Em **Settings → Environment Variables**, adicione:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (pública, okay expor)
   - `VAPID_PRIVATE_KEY` (secreta, não expor)
   - `VAPID_SUBJECT`

2. Deploy automático ativa as notificações.

## 4. Testar localmente

No seu `.env` local:

```env
# ... outras variáveis ...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BEi5...xyz
VAPID_PRIVATE_KEY=2aB1...abc
VAPID_SUBJECT=mailto:dev@local
RUN_CRON_LOCAL=true        # ativa cron em dev
```

```bash
npm run dev
# Abre o app, clica "Ativar" no prompt de notificações
# O cron roda diariamente às 08h (UTC-3)
```

Para testar fora do horário de cron:

```bash
# Dispara notificação manualmente
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "type": "test",
    "title": "Teste 🔔",
    "body": "Notificação chegou!",
    "requireInteraction": true
  }'
```

## 5. Como funciona

### Cliente (browser)

1. App pede permissão de notificações
2. Service Worker registra subscription
3. POST `/api/notifications/subscribe` com os dados de push
4. Browser guarda chaves de criptografia (encryption keys)

### Servidor

1. **Cron diário** (08:00 UTC-3) verifica:
   - Quem tem trial vencendo em 2 dias
   - Quem tem manutenção urgente/vencida
   - Envia notificações para todos os dispositivos do usuário

2. **Rota manual** `/api/notifications/send`:
   - Admin/backend dispara notificação sob demanda
   - Útil para notificações de campanha ou avisos urgentes

### Lifecycle

```
Usuário liga notificações
    ↓
SW registra subscription
    ↓
Browser armazena chaves (encrypted)
    ↓
POST /api/notifications/subscribe guarda no banco
    ↓
[Todos os dias às 08h]
    ↓
Cron busca usuários com trial/manutenção urgente
    ↓
Envia push para cada subscription registrada
    ↓
Browser mostra notificação (mesmo se app fechado)
    ↓
Usuário clica → app abre com contexto
```

## 6. Monitorar

Ver quais notificações foram enviadas:

```sql
SELECT * FROM notification_logs 
ORDER BY sent_at DESC 
LIMIT 50;

-- Ver subscriptions ativas por usuário
SELECT user_id, COUNT(*) as devices 
FROM push_subscriptions 
GROUP BY user_id;

-- Cleanup subscriptions expiradas (automático, mas se quiser manual)
DELETE FROM push_subscriptions 
WHERE last_sent_at < NOW() - INTERVAL '30 days';
```

## 7. Customização

### Mudar o horário da notificação diária

Em `src/lib/notification-cron.ts`:

```typescript
// Atual: 08:00 UTC-3 = 11:00 UTC
cron.schedule("0 11 * * *", async () => { ... })

// Mudar para 07:00 UTC-3 = 10:00 UTC:
cron.schedule("0 10 * * *", async () => { ... })
```

### Adicionar novo tipo de notificação

1. Edite `src/lib/notification-cron.ts` — adicione uma função `async function notifyXyz() { ... }`
2. Chame-a dentro do `cron.schedule()`
3. Use `sendPush()` com um `tag` único (agrupa notificações no OS)

### Ícone e badge customizados

Edite as chamadas `sendPush()`:

```typescript
await sendPush(sub, {
  title: "...",
  body: "...",
  icon: "/icons/icon-512.png",      // mude para seu ícone
  badge: "/icons/badge-192.png",    // ícone menor para barra
  tag: "manutenção-urgente",        // agrupa no OS
  requireInteraction: true,         // obriga clicar (não some sozinho)
});
```

## 8. Troubleshooting

**"Notificações não aparecem em produção"**
- ✅ Vercel tem as chaves VAPID configuradas?
- ✅ Cliente registrou subscription (verifique DB: `SELECT * FROM push_subscriptions;`)?
- ✅ Navegador tem permissão concedida (Chrome/Firefox/Safari settings)?

**"Erro 410 no Mercado Pago"**
Não relacionado — é do push. 410 = subscription expirou, auto-removida do banco.

**"Cron não dispara em dev"**
Defina `RUN_CRON_LOCAL=true` no `.env` local.

**"Como enviar notificação para um usuário específico?"**
POST `/api/notifications/send` com `userId`:
```bash
curl -X POST http://localhost:3000/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 5,
    "type": "custom",
    "title": "Alerta personalizado",
    "body": "Seu trial vence hoje!",
    "requireInteraction": true
  }'
```

## Referências

- [Web Push API MDN](https://developer.mozilla.org/pt-BR/docs/Web/API/Push_API)
- [web-push NPM](https://github.com/web-push-libs/web-push)
- [Cron Syntax](https://crontab.guru)
