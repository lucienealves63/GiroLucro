# Painel de acessos, assinantes e contato

O GiroLucro agora mede o próprio tráfego e recebe mensagens de suporte — **sem
Google Analytics, sem serviço externo, sem cookie de terceiros**. Os números
ficam no seu banco (Neon/Vercel Postgres) e a leitura é no navegador, pelo link.

## O que entrou

| Endereço | O que é |
| --- | --- |
| `/admin` | Painel com 5 abas: **Acessos**, **Desempenho das visitas**, **Assinantes**, **Contato**, **Diagnóstico** |
| `/contato` | Página pública de contato (suporte, bug, pagamento, ideia) |
| `/api/visit` | Coleta de visitas (chamada pelo próprio app) |
| `/api/contact` | Recebe o formulário de contato |
| `/api/admin/export` | CSV de acessos, páginas, assinantes e mensagens |
| `/api/admin/demo-visits` | Enche o painel com visitas de mentira para testar (e limpa depois) |

## 1. Ligar as tabelas novas (1 link, sem terminal)

Depois de publicar este código, abra **uma vez**:

```
https://SEU-DOMINIO/api/admin/setup?token=SEU_TOKEN
```

Ele cria `page_views` (visitas) e `contact_messages` (contato). É idempotente:
não apaga nem duplica nada que já existe. Quem usa terminal pode rodar
`npx drizzle-kit push` (a migration `drizzle/0003_*.sql` também está no repo).

## 2. Entrar no painel

```
https://SEU-DOMINIO/admin?token=SEU_TOKEN      → já entra direto
https://SEU-DOMINIO/admin                       → pede o token numa tela de login
```

O token é a mesma variável `ADMIN_SETUP_TOKEN` do setup. No login por tela o
painel ganha um cookie `httpOnly` assinado (dura 12h) — o token não fica
guardado no navegador. **Não mande o link com `?token=` para ninguém.**

Se você nunca trocou `ADMIN_SETUP_TOKEN`, o painel avisa na aba *Diagnóstico*:
crie a variável na Vercel com um valor só seu e faça Redeploy.

## 3. O que cada aba mostra

**Acessos** — pessoas únicas, visitas (sessões), visualizações, páginas por
visita, gráfico do dia a dia, páginas mais vistas, de onde vieram (busca,
Instagram, indicação…), aparelhos, navegadores, países e campanhas com `utm_`.

**Desempenho das visitas** — média por dia, últimos 7 dias com comparação
contra os 7 anteriores, tempo médio na página, taxa de salto, mapa de horários
(quando seu público abre o app), desempenho por dia da semana, tabela
página × desempenho (participação, pessoas, tempo médio) e por onde as pessoas
começam e abandonam.

**Assinantes** — contas criadas, em teste, pagantes, recebido, funil
*visita → conta → teste → pago*, situação das assinaturas, cadastros por dia,
qual canal/página traz assinante e a lista dos últimos cadastros com a origem
de cada um.

**Contato** — a caixa de entrada do `/contato`: expandir, marcar respondida,
arquivar, excluir e responder pelo seu e-mail. As mensagens ficam **sempre** no
banco; o e-mail é só uma cópia.

**Diagnóstico** — diz se as tabelas existem, se a medição está recebendo visitas
de verdade, se o e-mail do contato está configurado e se o token é personalizado,
com os links de correção.

## 4. Como a visita é medida (e por que não quebra nada)

- Um componente no layout (`src/components/visit-tracker.tsx`) avisa o app a cada
  troca de página (`POST /api/visit`) e, ao sair da aba, envia o tempo gasto.
- `gl_vid` é um **UUID de primeiro domínio**: serve para contar “pessoas únicas”
  sem IP e sem tracker externo. `gl_sid` (sessionStorage) agrupa a mesma visita.
- Robôs (Semrush, bots de link do WhatsApp, Lighthouse…) entram marcados como
  `is_bot` e ficam **fora** de todas as contas do painel.
- Se o banco estiver fora do ar, o beacon falha em silêncio (204) — nenhuma
  página quebra por causa de medição.
- Só o `user_id` de quem está logado é guardado (para ligar visita → assinante).
  Nada de senha, e-mail ou IP nas tabelas de análise.

Para não se contar enquanto mexe no app, rode no console do navegador:
`localStorage.setItem('gl_analytics_off','1')`. Para ligar de novo,
`localStorage.removeItem('gl_analytics_off')`.

## 5. E-mail de cópia do contato (opcional)

Sem configurar nada, o `/contato` **já funciona**: a mensagem fica salva e aparece
no painel. Para receber também no seu e-mail, adicione na Vercel (as mesmas
variáveis já usadas na recuperação de senha):

| Variável | Para quê |
| --- | --- |
| `RESEND_API_KEY` | chave da Resend (já usada no “esqueci minha senha”) |
| `EMAIL_FROM` | remetente verificado, ex.: `GiroLucro <contato@seudominio.com.br>` |
| `CONTACT_TO_EMAIL` | para onde a mensagem vai (se omitido, usa o `EMAIL_FROM`) |
| `APP_URL` | endereço definitivo do app |

Depois de salvar: **Deployments → Redeploy**. A aba *Diagnóstico* confirma se o
canal ficou ativo, e cada mensagem mostra “cópia enviada ✓” ou o motivo da falha.

## 6. Testar agora, sem esperar tráfego real

```
https://SEU-DOMINIO/api/admin/demo-visits?token=SEU_TOKEN&dias=30&porDia=14
```

Cria visitas de demonstração (todas com `visitor_id` começando em `demo-`) e uma
mensagem de exemplo na caixa de contato. Para limpar:

```
https://SEU-DOMINIO/api/admin/demo-visits?token=SEU_TOKEN&action=clear
```

## 7. Integrar com o que você já usa

```
https://SEU-DOMINIO/admin?format=json&dias=30&token=SEU_TOKEN      → números do painel
https://SEU-DOMINIO/api/admin/export?table=visits&dias=30&token=SEU_TOKEN    → CSV
https://SEU-DOMINIO/api/admin/export?table=pages&token=SEU_TOKEN             → CSV por página
https://SEU-DOMINIO/api/admin/export?table=users&token=SEU_TOKEN             → CSV de assinantes
https://SEU-DOMINIO/api/admin/export?table=messages&token=SEU_TOKEN           → CSV do contato
```

Os CSVs usam `;` e BOM, padrão que o Excel em português abre direto.

## Segurança

- `/admin`, `/api/admin/*` e `/api/visit` não indexáveis (`robots.txt` +
  `X-Robots-Tag: noindex`).
- Toda ação de escrita do painel (marcar respondida, arquivar, excluir) exige o
  cookie de admin **e** o token ecoado no formulário (CSRF double-submit).
- Formulário de contato: honeypot, limite de 5 mensagens por hora por
  IP/visitante (IP só entra hasheado, para não virar dado pessoal) e validação
  de tamanho/conteúdo.
- Nada de número de cartão no painel: quem vende é o Mercado Pago; aqui só
  aparece a situação da assinatura.
