import { CHANNEL_LABELS } from "@/lib/analytics";
import { barRows, card, esc, kpi, note, table, visitsChart } from "@/lib/admin-html";
import type { NamedCount, Report } from "@/lib/admin-report";

/**
 * As telas do painel /admin (acessos, desempenho, assinantes, pedidos, contato).
 * Renderizam HTML a partir do `Report` – sem JavaScript no navegador.
 */

const NUM = new Intl.NumberFormat("pt-BR");
const DEC = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const PCT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const n = (v: number): string => NUM.format(Math.round(v || 0));

export function pct(v: number, digits = 1): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format((v || 0) * 100)}%`;
}

export function dur(ms: number): string {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return rest ? `${m}m${String(rest).padStart(2, "0")}` : `${m}min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

export function rel(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return "—";
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} dia${d === 1 ? "" : "s"}`;
}

export function dateBR(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

function delta(current: number, prev: number): string {
  if (!prev) return current ? `<span class="up">novo</span> no período` : "sem histórico";
  const change = (current - prev) / prev;
  const cls = change >= 0 ? "up" : "down";
  const arrow = change >= 0 ? "▲" : "▼";
  return `<span class="${cls}">${arrow} ${PCT.format(Math.abs(change * 100))}%</span> vs. período anterior`;
}

/** tokenQs chega com "?" — para URL que já tem query, precisa de "&". */
const amp = (tokenQs: string): string => (tokenQs ? tokenQs.replace("?", "&") : "");

const channelLabel = (raw: string): string =>
  (CHANNEL_LABELS as Record<string, string>)[raw] ?? raw;

function relabelChannels(items: NamedCount[]): NamedCount[] {
  return items.map((i) => ({ ...i, label: channelLabel(i.label) }));
}

function funnel(steps: { label: string; value: number; hint?: string }[]): string {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return `<div class="rows">${steps
    .map(
      (s) => `<div class="row">
        <span class="name">${esc(s.label)}${s.hint ? ` <span class="small">· ${esc(s.hint)}</span>` : ""}</span>
        <span class="bar"><i style="width:${Math.max(2.5, (s.value / max) * 100)}%"></i></span>
        <span class="v">${n(s.value)}</span>
      </div>`,
    )
    .join("")}</div>`;
}

/** Aviso único quando as tabelas existem mas ainda não há visita nenhuma. */
function noDataYet(r: Report, tokenQs: string): string {
  const v = r.visits;
  if (v && v.views > 0) return "";
  return note(
    "info",
    "Nenhuma visita registrada no período",
    `Assim que alguém abrir uma página o contador começa a subir sozinha. Para ver o painel populado agora (dados de mentira, fáceis de limpar depois), rode
     <a href="/api/admin/demo-visits${esc(tokenQs)}&dias=30">/api/admin/demo-visits</a> e recarregue esta página
     — e <a href="/api/admin/demo-visits?action=clear${tokenQs.startsWith("?") ? tokenQs.replace("?", "&") : ""}">este outro link</a> limpa a demonstração.
     <div class="small" style="margin-top:6px">Se você acabou de abrir o app nesta aba, a visita já foi contada: veja o horário do último acesso abaixo.</div>`,
  );
}

/* ------------------------------- 1. acessos -------------------------------- */

export function viewVisits(r: Report, hrefFor: (days: number) => string, tokenQs = "?token=SEU_TOKEN"): string {
  const v = r.visits;
  if (!v) {
    return setupNeeded(r, tokenQs);
  }
  const best = [...v.series].sort((a, b) => b.views - a.views)[0];
  const noData = noDataYet(r, tokenQs);
  return `
  ${noData}
  <div class="grid g4" style="margin-bottom:12px">
    ${kpi("Pessoas únicas", n(v.visitors), delta(v.visitors, v.prev.visitors))}
    ${kpi("Visitas (sessões)", n(v.sessions), delta(v.sessions, v.prev.sessions))}
    ${kpi("Visualizações", n(v.views), delta(v.views, v.prev.views))}
    ${kpi("Páginas / visita", DEC.format(v.avgPagesPerVisit), `${pct(v.bounceRate, 0)} saltam na 1ª página`)}
  </div>

  ${card(
    `Visitas por dia · últimos ${r.range.days} dias`,
    visitsChart(v.series) +
      `<div class="msg" style="margin:14px 0 0;padding:0;border:0;background:none;display:flex;flex-wrap:wrap;gap:14px;font-size:12px;color:#a1a1aa">
        <span>📅 Melhor dia: <b style="color:#fafafa">${esc(best?.label ?? "—")} · ${n(best?.views ?? 0)}</b></span>
        <span>⏱️ Tempo médio: <b style="color:#fafafa">${dur(v.avgDwellMs)}</b></span>
        <span>🤖 ${n(v.botViews)} acessos de robôs foram <b style="color:#fafafa">ignorados</b></span>
        <span>🕒 Último acesso: <b style="color:#fafafa">${rel(v.lastViewAt)}</b></span>
      </div>`,
    `<a href="${esc(hrefFor(r.range.days))}">atualizar</a>`,
  )}

  <div class="grid g2" style="margin-top:12px">
    ${card("Páginas mais vistas", table(
      ["Página", "Visitas", "Pessoas"],
      v.topPages.slice(0, 9).map((p) => [esc(p.label), n(p.value), n(p.visitors ?? 0)]),
    ))}
    ${card("De onde vieram", barRows(
      relabelChannels(v.channels).map((c) => ({ ...c, hint: `${n(c.visitors ?? 0)} pessoas` })),
    ))}
  </div>

  <div class="grid g3" style="margin-top:12px">
    ${card("Origens (referers)", barRows(
      v.referrers.map((x, i) => ({ ...x, barClass: i % 4 === 1 ? "b2" : i % 4 === 2 ? "b3" : "" })),
      "Só acesso direto por enquanto.",
    ))}
    ${card("Aparelhos", barRows(
      v.devices.map((d) => ({ ...d, hint: `${n(d.visitors ?? 0)} pessoas` })),
    ))}
    ${card("Navegadores", barRows(v.browsers))}
  </div>

  ${v.campaigns.length
    ? `<div style="margin-top:12px">${card(
        "Campanhas (utm_source · utm_campaign)",
        table(
          ["Campanha", "Visitas", "Pessoas", "Logados"],
          v.campaigns.map((c) => [esc(c.label), n(c.value), n(c.visitors ?? 0), esc(c.hint ?? "")]),
        ),
      )}</div>`
    : ""}

  ${v.countries.length && v.countries.some((c) => c.label !== "—")
    ? `<div style="margin-top:12px">${card("Países", barRows(v.countries, "Sem informação de país."))}</div>`
    : ""}
  `;
}

/* ----------------------------- 2. desempenho ------------------------------- */

export function viewPerformance(r: Report, tokenQs = "?token=SEU_TOKEN"): string {
  const v = r.visits;
  if (!v) return setupNeeded(r, tokenQs);

  const activeDays = v.series.filter((d) => d.views > 0).length || 1;
  const avgPerDay = v.views / activeDays;
  const last7 = v.series.slice(-7);
  const prev7 = v.series.slice(-14, -7);
  const sum = (a: { views: number }[]) => a.reduce((s, d) => s + d.views, 0);
  const weekDelta = delta(sum(last7), sum(prev7));
  const maxHour = Math.max(...v.hours.map((h) => h.views), 1);
  const peak = [...v.hours].sort((a, b) => b.views - a.views)[0];
  const bestWeekday = [...v.weekdays].sort((a, b) => b.avg - a.avg)[0];
  const noData = noDataYet(r, tokenQs);

  const heat = `<div style="display:flex;gap:4px;align-items:flex-end;height:96px">
    ${v.hours
      .map((h) => {
        const ratio = h.views / maxHour;
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;height:100%;justify-content:flex-end" title="${String(
          h.hour,
        ).padStart(2, "0")}h · ${n(h.views)} visitas">
          <div style="width:100%;border-radius:4px;height:${Math.max(4, ratio * 74)}px;background:rgba(184,245,60,${(
            0.18 +
            ratio * 0.82
          ).toFixed(2)})"></div>
          <span style="font-size:9px;color:#52525b;font-weight:700">${h.hour}</span>
        </div>`;
      })
      .join("")}
  </div>
  <p class="small" style="margin-top:8px">Horários de Brasília · ${n(
    peak?.views ?? 0,
  )} visitas no pico (${String(peak?.hour ?? 0).padStart(2, "0")}h)</p>`;

  const perPage = v.topPages.slice(0, 8).map((p, i) => {
    const day = v.series.reduce((a, d) => a + d.views, 0) || 1;
    return [
      esc(p.label),
      n(p.value),
      `${((p.value / day) * 100).toFixed(0)}%`,
      n(p.visitors ?? 0),
      dur((p.hint ? Number.parseInt(p.hint, 10) : 0) * 1000),
      i === 0 ? `<span class="tag pago">top</span>` : "",
    ];
  });

  return `
  ${noData}
  <div class="grid g4" style="margin-bottom:12px">
    ${kpi("Média por dia", n(avgPerDay), `${n(v.series.length)} dias no intervalo`)}
    ${kpi("Últimos 7 dias", n(sum(last7)), weekDelta)}
    ${kpi("Tempo médio na página", dur(v.avgDwellMs), "medido ao sair da aba")}
    ${kpi("Taxa de salto", pct(v.bounceRate, 0), `${pct(1 - v.bounceRate, 0)} veem 2+ páginas`)}
  </div>

  <div class="grid g2" style="margin-bottom:12px">
    ${card("Quando seu público visita", heat)}
    ${card(
      "Desempenho por dia da semana",
      table(
        ["Dia", "Visitas", "Média/dia"],
        v.weekdays.map((w) => [
          esc(w.label),
          n(w.views),
          `${DEC.format(w.avg)} ${w === bestWeekday ? '<span class="tag pago">melhor</span>' : ""}`,
        ]),
      ),
    )}
  </div>

  ${card(
    `Página × desempenho · ${r.range.days} dias`,
    table(["Página", "Visualizações", "Participação", "Pessoas", "Tempo médio", ""], perPage),
  )}

  <div class="grid g2" style="margin-top:12px">
    ${card("Por onde começam", barRows(v.entryPages))}
    ${card("Onde abandonam", barRows(v.exitPages.map((x) => ({ ...x, barClass: "b4" }))))}
  </div>

  ${note(
    "info",
    "Como ler",
    "“Visita” = uma janela/aba aberta (sessão). “Pessoa” = navegador único no período (cookie próprio <code>gl_vid</code>, sem IP). Tempo médio conta só quem ficou mais de 1s na página.",
  )}
  `;
}

/* ------------------------------ 3. assinantes ------------------------------ */

export function viewSubscribers(r: Report, tokenQs = ""): string {
  const s = r.subscribers;
  const revenue = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(s.revenue);
  return `
  <div class="grid g4" style="margin-bottom:12px">
    ${kpi("Contas criadas", n(s.total), `${n(s.newInPeriod)} novas em ${r.range.days} dias · ${delta(s.newInPeriod, s.prevNew)}`)}
    ${kpi(
      "Em teste grátis",
      n(s.trialsActive),
      s.trialsEndingSoon
        ? `<span class="down">${n(s.trialsEndingSoon)} vencem em 3 dias</span>`
        : `${n(s.trialsExpired)} já venceram`,
    )}
    ${kpi("Pagantes", n(s.paying), `${pct(s.paidRate, 1)} das contas · pagamento único`)}
    ${kpi("Recebido", esc(revenue), `${n(s.pendingPayment)} aguardando Pix/cartão`)}
  </div>

  <div class="grid g2" style="margin-bottom:12px">
    ${card(
      "Funil de conversão",
      funnel([
        { label: "Pessoas que visitaram", value: r.visits?.visitors ?? 0, hint: `${r.range.days} dias` },
        { label: "Criaram conta", value: s.total, hint: pct(s.signupRate, 1) + " dos visitantes" },
        { label: "Teste em andamento", value: s.trialsActive },
        { label: "Pagaram (Pro)", value: s.paying, hint: pct(s.paidRate, 1) + " das contas" },
      ]) +
        (r.visits
          ? `<p class="small" style="margin-top:10px">⚠️ Se “pessoas que visitaram” estiver 0, a medição não está gravando — veja a aba <a href="/admin?aba=diagnostico">Diagnóstico</a>.</p>`
          : ""),
    )}
    ${card(
      "Situação do acesso",
      barRows(s.byStatus) +
        `<p class="small" style="margin-top:10px">${n(s.canceled)} acessos encerrados · ${n(
          s.activeLast7,
        )} pagantes abriram o app nos últimos 7 dias</p>`,
    )}
  </div>

  ${card(
    `Cadastros por dia · ${r.range.days} dias`,
    visitsChart(
      s.series.map((d) => ({ day: d.day, label: d.label, views: d.signups, visitors: d.paid, sessions: 0, signups: d.paid })),
      { barUnit: "cadastro", peopleUnit: "pagante" },
    ) + `<p class="small" style="margin-top:6px">Barras = contas criadas · pontos azuis = contas pagas naquele dia</p>`,
  )}

  <div class="grid g2" style="margin-top:12px">
    ${card("Qual canal traz pagante", barRows(
      relabelChannels(s.attribution).map((a) => ({ ...a, hint: a.hint })),
      "Sem sessão de visita vinculada ainda.",
    ))}
    ${card("Qual página fecha a venda", barRows(
      s.topLandingPages.map((a) => ({ ...a, barClass: "b2" })),
      "A página em que a pessoa estava quando a conta foi criada.",
    ))}
  </div>

  <div style="margin-top:12px">${card(
    "Últimos cadastros",
    s.recent.length
      ? table(
          ["Quem", "Criada", "Situação", "Canal", "Vinda de"],
          s.recent.map((u) => [
            `<b>${esc(u.name)}</b><div class="small">${esc(u.email)}</div>`,
            esc(u.createdDay ? `${u.createdDay.slice(8, 10)}/${u.createdDay.slice(5, 7)}` : "—"),
            `<span class="tag ${u.statusClass}">${esc(u.statusLabel)}</span>`,
            esc(channelLabel(u.channel)),
            `<div>${esc(u.entryPath)}</div><div class="small">${esc(u.referrer)}</div>`,
          ]),
        )
      : `<div class="empty"><b>Nenhuma conta criada ainda.</b>Compartilhe sua landing e as visitas/cadastros aparecem aqui automaticamente.</div>`,
    `<a href="/api/admin/export?table=users${amp(tokenQs)}">exportar CSV</a>`,
  )}</div>
  `;
}

/* -------------------------------- 4. contato -------------------------------- */

export const TOPIC_LABELS: Record<string, string> = {
  duvida: "Dúvida",
  bug: "Bug / erro",
  pagamento: "Pagamento",
  parceria: "Parceria",
  recurso: "Pedido de função",
  outro: "Outro",
};

export function viewContact(r: Report, csrf: string, tokenParam: string): string {
  const c = r.contact;
  if (!r.ok && r.problems.includes("tabela:contact_messages")) return setupNeeded(r, tokenParam ? `?token=${encodeURIComponent(tokenParam)}` : "?token=SEU_TOKEN");
  const qs = tokenParam ? `&token=${encodeURIComponent(tokenParam)}` : "";
  return `
  <div class="grid g4" style="margin-bottom:12px">
    ${kpi("Mensagens novas", n(c.unread), c.unread ? "precisam de resposta" : "tudo em dia")}
    ${kpi("Total recebido", n(c.total), "desde que o painel foi ligado")}
    ${kpi("Página de contato", `<a href="/contato${""}" target="_blank" class="small" style="font-size:16px">/contato ↗</a>`, "aberta para visitantes")}
    ${kpi(
      "Cópia por e-mail",
      c.rows.some((m) => m.emailSent)
        ? `<span class="up">enviada</span>`
        : c.rows.length
          ? `<span class="down">não enviada</span>`
          : "opcional",
      "via Resend · nada se perde no banco",
    )}
  </div>

  ${card(
    `Caixa de entrada · ${n(c.total)} mensagem(ns)`,
    c.rows.length
      ? c.rows
          .map((m) => {
            const topic = TOPIC_LABELS[m.topic] ?? m.topic;
            const mailto = `mailto:${esc(m.email)}?subject=${encodeURIComponent("Re: GiroLucro")}`;
            return `<details class="msg" ${m.status === "novo" ? "open" : ""}>
              <summary>
                <span class="tag ${esc(m.status)}">${esc(m.status)}</span>
                <span class="who">${esc(m.name)}</span>
                <span class="mail">${esc(m.email)}${m.phone ? ` · ${esc(m.phone)}` : ""}</span>
                <span class="mail">· ${esc(topic)} · ${dateBR(m.createdAt)}</span>
                <span class="actions">
                  <button class="btn" form="f-${m.id}-ok" type="submit">${
                  m.status === "respondido" ? "reabrir" : "marcar respondida"
                }</button>
                  <button class="btn" form="f-${m.id}-ar" type="submit">arquivar</button>
                  <button class="btn dan" form="f-${m.id}-del" type="submit">excluir</button>
                </span>
              </summary>
              <div class="body">${esc(m.body)}</div>
              <div class="meta">
                <span>Resposta pedida por e-mail: ${m.replyToEmail ? "sim" : "não"}</span>
                <span>Enviada de <code>${esc(m.sourcePath ?? "/")}</code></span>
                <span>Cópia por e-mail: ${m.emailSent ? "enviada ✓" : `não enviada${m.emailError ? ` (${esc(m.emailError)})` : ""}`}</span>
                ${m.userId ? `<span>Conta no app: #${m.userId}</span>` : ""}
                <a href="${mailto}">responder por e-mail ↗</a>
              </div>
            </details>
            <form class="inline" id="f-${m.id}-ok" method="POST" action="/admin?${qs.slice(1)}">
              <input type="hidden" name="csrf" value="${esc(csrf)}" />
              <input type="hidden" name="action" value="${m.status === "respondido" ? "reopen" : "answered"}" />
              <input type="hidden" name="id" value="${m.id}" />
            </form>
            <form class="inline" id="f-${m.id}-ar" method="POST" action="/admin?${qs.slice(1)}">
              <input type="hidden" name="csrf" value="${esc(csrf)}" />
              <input type="hidden" name="action" value="archive" />
              <input type="hidden" name="id" value="${m.id}" />
            </form>
            <form class="inline" id="f-${m.id}-del" method="POST" action="/admin?${qs.slice(1)}">
              <input type="hidden" name="csrf" value="${esc(csrf)}" />
              <input type="hidden" name="action" value="delete" />
              <input type="hidden" name="id" value="${m.id}" />
            </form>`;
          })
          .join("")
      : `<div class="empty"><b>Suas mensagens aparecem aqui.</b>Quem preencher o formulário em <code>/contato</code> cai nesta lista — mesmo que o e-mail de cópia esteja sem configurar.</div>`,
  )}

  ${
    c.rows.some((m) => !m.emailSent)
      ? note(
          "warn",
          "A cópia por e-mail não está saindo",
          "As mensagens continuam guardadas aqui (nada se perde). Para receber também no seu e-mail, configure <code>RESEND_API_KEY</code>, <code>EMAIL_FROM</code> e <code>CONTACT_TO_EMAIL</code> na Vercel e clique em Redeploy — a aba <a href=\"/admin?aba=diagnostico\">Diagnóstico</a> mostra exatamente o que falta.",
        )
      : ""
  }
  `;
}

/* ------------------------------ 5. diagnóstico ------------------------------ */

export function setupNeeded(r: Report, tokenQs = "?token=SEU_TOKEN"): string {
  return note(
    "err",
    "Faltam as tabelas do painel",
    `Abra <a href="/api/admin/setup${esc(tokenQs)}"><b>/api/admin/setup${esc(tokenQs)}</b></a> no navegador — ele cria <code>page_views</code> e <code>contact_messages</code> sem apagar nada. Depois recarregue esta página.${
      r.problems.length ? `<div class="small" style="margin-top:6px">ausentes: ${r.problems.map((p) => `<code>${esc(p)}</code>`).join(" ")}</div>` : ""
    }`,
  );
}

/** O aviso de setup aparece uma única vez por página. */
export function tabRendersSetupCallout(tab: string): boolean {
  return tab === "visitas" || tab === "desempenho" || tab === "contato";
}

export function viewDiagnostics(
  env: Record<string, { ok: boolean; detail: string }>,
  r: Report,
  tokenQs = "?token=SEU_TOKEN",
): string {
  const rows = Object.entries(env).map(([label, v]) =>
    table(
      ["", ""],
      [[esc(label), v.ok ? `<span class="tag pago">ok ✓</span>` : `<span class="tag morto">pendente</span>`]],
    ) + `<div class="small" style="margin:-6px 0 10px">${v.detail}</div>`,
  );
  return `
  ${card("Status da medição e do contato", rows.join("") || `<div class="empty">tudo certo</div>`)}
  <div class="grid g2" style="margin-top:12px">
    ${card(
      "Links úteis",
      `<div class="rows">
        <div class="row"><span class="name">Criar/atualizar tabelas</span><span></span><a class="btn" href="/api/admin/setup${esc(tokenQs)}">abrir ↗</a></div>
        <div class="row"><span class="name">Diagnóstico de pagamento</span><span></span><a class="btn" href="/api/admin/billing-status${esc(tokenQs)}">abrir ↗</a></div>
        <div class="row"><span class="name">Diagnóstico de e-mail</span><span></span><a class="btn" href="/api/admin/email-status${esc(tokenQs)}">abrir ↗</a></div>
        <div class="row"><span class="name">Gerar visitas de demonstração</span><span></span><a class="btn" href="/api/admin/demo-visits${esc(tokenQs)}&dias=30">rodar ↗</a></div>
        <div class="row"><span class="name">Lembretes de reembolso (conferir, sem enviar)</span><span></span><a class="btn" href="/api/cron/reminders${esc(tokenQs)}&dry=1">abrir ↗</a></div>
        <div class="row"><span class="name">Lembretes de reembolso (enviar agora)</span><span></span><a class="btn" href="/api/cron/reminders${esc(tokenQs)}">rodar ↗</a></div>
        <div class="row"><span class="name">Exportar acessos (CSV)</span><span></span><a class="btn" href="/api/admin/export?table=visits${esc(amp(tokenQs))}">baixar ↗</a></div>
        <div class="row"><span class="name">Ver como JSON (integrações)</span><span></span><a class="btn" href="/admin?format=json">abrir ↗</a></div>
      </div>`,
    )}
    ${card(
      "Período atual",
      `<p style="font-size:13px;color:#a1a1aa">Mostrando <b style="color:#fafafa">${esc(
        r.range.from,
      )}</b> a <b style="color:#fafafa">${esc(r.range.to)}</b> (${r.range.days} dias), fuso America/Sao_Paulo.</p>
       <p class="small" style="margin-top:8px">Troque o intervalo nos chips acima (7 / 30 / 90 dias) ou na URL: <code>?dias=90</code>.</p>`,
    )}
  </div>
  `;
}

/* ---------------------- pedidos de reembolso / LGPD ----------------------- */

const REFUND_STATUS_LABELS: Record<string, string> = {
  requested: "pedido aberto",
  processing: "processando",
  manual: "análise manual",
  refunded: "reembolsado",
  denied: "não aprovado",
  none: "sem pedido",
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  export: "Exportação de dados",
  deletion: "Exclusão de conta",
  refund: "Reembolso",
  correction: "Correção",
  consent: "Consentimento",
};

function money(v: number | null): string {
  if (v === null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isPending(status: string | null): boolean {
  return status === "manual" || status === "requested" || status === "processing";
}

/**
 * Fila de reembolso (quando o Mercado Pago não pôde ser chamado direto ou o
 * pedido chegou fora do prazo) + histórico de solicitações de titular (LGPD).
 */
export function viewRequests(r: Report, csrf: string, tokenParam: string): string {
  const qs = tokenParam ? `&token=${encodeURIComponent(tokenParam)}` : "";
  const all = r.requests.refunds;
  const pending = all.filter((x) => isPending(x.refundStatus));
  const history = all.filter((x) => !isPending(x.refundStatus));

  const pendingCards = pending.length
    ? pending
        .map(
          (x) => `<details class="msg" open>
            <summary>
              <span class="tag ${esc(x.refundStatus ?? "")}">${esc(REFUND_STATUS_LABELS[x.refundStatus ?? ""] ?? x.refundStatus ?? "")}</span>
              <span class="who">${esc(x.name)}</span>
              <span class="mail">${esc(x.email)}</span>
              <span class="mail">· ${money(x.amount)} · compra em ${dateBR(x.paidAt ?? "")}${
                x.daysSincePurchase !== null
                  ? ` (${x.daysSincePurchase} dia${x.daysSincePurchase === 1 ? "" : "s"})`
                  : ""
              }</span>
              <span class="actions">
                <button class="btn" form="rf-ok-${x.userId}" type="submit">reembolso feito</button>
                <button class="btn dan" form="rf-no-${x.userId}" type="submit">recusar</button>
              </span>
            </summary>
            <div class="meta">
              <span>Conta #${x.userId}</span>
              <span>Pago por <code>${esc(x.provider ?? "—")}</code> · status ${esc(x.paymentStatus ?? "—")}</span>
              <span>Identificador para buscar no provedor: <code>${esc(x.paymentId ?? "—")}</code></span>
              <span>Pedido aberto em ${dateBR(x.requestedAt ?? "")}</span>
              <span>${x.withinWindow ? "Dentro do prazo de 7 dias" : "Fora do prazo de 7 dias — análise comercial"}</span>
            </div>
            <form class="inline" id="rf-ok-${x.userId}" method="POST" action="/admin?aba=pedidos${qs}">
              <input type="hidden" name="csrf" value="${esc(csrf)}" />
              <input type="hidden" name="tab" value="pedidos" />
              <input type="hidden" name="action" value="refund_settle" />
              <input type="hidden" name="id" value="${x.userId}" />
              <input type="hidden" name="result" value="refunded" />
            </form>
            <form class="inline" id="rf-no-${x.userId}" method="POST" action="/admin?aba=pedidos${qs}">
              <input type="hidden" name="csrf" value="${esc(csrf)}" />
              <input type="hidden" name="tab" value="pedidos" />
              <input type="hidden" name="action" value="refund_settle" />
              <input type="hidden" name="id" value="${x.userId}" />
              <input type="hidden" name="result" value="denied" />
            </form>
          </details>`,
        )
        .join("")
    : `<div class="empty">Nenhum pedido aguardando ação. 🎉</div>`;

  return `
  <div class="grid g4" style="margin-bottom:12px">
    ${kpi("Aguardando ação", n(pending.length), pending.length ? "reembolso pendente" : "fila vazia")}
    ${kpi("Reembolsos registrados", n(history.filter((x) => x.refundStatus === "refunded").length), "últimos 60 pedidos")}
    ${kpi("Solicitações LGPD", n(r.requests.dataRequests.length), "exportação/exclusão registradas")}
    ${kpi("Prazo de reembolso", "7 dias", "contados da confirmação do pagamento")}
  </div>

  ${note(
    "info",
    "Como processar um reembolso",
    `Abra o <b>Mercado Pago → Atividade</b>, busque pelo <b>identificador da transação</b> mostrado no pedido e use a opção <b>Reembolsar</b>. Depois clique em <b>reembolso feito</b> aqui: o app encerra o acesso Pro, grava a data e envia o e-mail de confirmação. Se preferir recusar, escolha <b>recusar</b> — a pessoa recebe o aviso e o acesso continua ativo.`,
  )}

  ${card(`Fila de reembolso · ${n(pending.length)} pedido(s)`, pendingCards)}

  ${card(
    "Histórico de reembolsos",
    history.length
      ? table(
          ["Pessoa", "Valor", "Compra", "Pedido", "Situação"],
          history.map((x) => [
            `${esc(x.name)}<div class="small">${esc(x.email)}</div>`,
            money(x.amount),
            dateBR(x.paidAt ?? ""),
            dateBR(x.requestedAt ?? ""),
            esc(REFUND_STATUS_LABELS[x.refundStatus ?? ""] ?? x.refundStatus ?? "—"),
          ]),
        )
      : `<div class="empty">Nenhum reembolso concluído ou recusado ainda.</div>`,
  )}

  ${card(
    "Solicitações de titular (LGPD)",
    r.requests.dataRequests.length
      ? table(
          ["#", "Tipo", "Registrada em", "Concluída em", "Situação"],
          r.requests.dataRequests.map((d) => [
            String(d.id),
            esc(REQUEST_TYPE_LABELS[d.requestType] ?? d.requestType),
            dateBR(d.createdAt),
            d.completedAt ? dateBR(d.completedAt) : "—",
            esc(d.status),
          ]),
        )
      : `<div class="empty">Nenhuma solicitação registrada. Exportações e exclusões aparecem aqui.</div>`,
  )}
  `;
}
