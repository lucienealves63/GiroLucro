/**
 * Renderização do painel /admin — HTML puro com CSS inline.
 *
 * O painel é uma *route handler* (`src/app/admin/route.ts`), igual ao
 * /api/admin/setup e /api/admin/billing-status que já existem no projeto:
 * nada de dependência de cliente, funciona no celular e no computador, e
 * não quebra quando o resto do app está com problema.
 */

export function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>'"]/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[char] ?? char;
  });
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{background:#050608;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:#b8f53c;text-decoration:none}
.wrap{max-width:1080px;margin:0 auto;padding:20px 16px 64px}
header.top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:6px 0 18px;border-bottom:1px solid rgba(255,255,255,.07)}
.brand{display:flex;align-items:center;gap:10px}
.mark{width:34px;height:34px;border-radius:11px;background:#b8f53c;display:flex;align-items:center;justify-content:center;flex:none}
.mark svg{width:20px;height:20px}
h1{font-size:17px;font-weight:800;letter-spacing:-.01em}
h1 span{color:#b8f53c}
.top .sub{font-size:11.5px;color:#71717a;margin-top:1px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:16px 0 4px}
.tab{padding:8px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:#a1a1aa;font-size:12.5px;font-weight:700}
.tab:hover{color:#e4e4e7}
.tab.on{background:#b8f53c;border-color:#b8f53c;color:#08090c}
.ranges{display:flex;gap:6px;margin-left:auto}
.chip{padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.08);color:#a1a1aa;font-size:11.5px;font-weight:700}
.chip.on{border-color:rgba(184,245,60,.55);color:#b8f53c;background:rgba(184,245,60,.08)}
.grid{display:grid;gap:12px}
.g4{grid-template-columns:repeat(4,minmax(0,1fr))}
.g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.g2{grid-template-columns:repeat(2,minmax(0,1fr))}
@media(max-width:860px){.g4{grid-template-columns:repeat(2,minmax(0,1fr))}.g3{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.g2,.g3,.g4{grid-template-columns:1fr}.ranges{margin-left:0;width:100%}}
.card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px}
.card h2{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#71717a;margin-bottom:12px;display:flex;justify-content:space-between;gap:8px;align-items:center}
.card h2 em{font-style:normal;text-transform:none;letter-spacing:0;font-size:11px;color:#a1a1aa;font-weight:600}
.kpi{display:flex;flex-direction:column;gap:3px;padding:15px 16px}
.kpi .lbl{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#71717a}
.kpi .val{font-size:27px;font-weight:800;letter-spacing:-.02em;color:#fafafa;font-variant-numeric:tabular-nums}
.kpi .val small{font-size:14px;font-weight:700;color:#a1a1aa}
.kpi .dlt{font-size:11.5px;font-weight:700;color:#a1a1aa}
.up{color:#b8f53c}.down{color:#fb7185}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#71717a;font-weight:800;padding:0 8px 8px 0;border-bottom:1px solid rgba(255,255,255,.07)}
td{padding:9px 8px 9px 0;border-bottom:1px solid rgba(255,255,255,.045);vertical-align:top;color:#d4d4d8;font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;padding-right:0}
.bar{height:6px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;min-width:54px}
.bar>i{display:block;height:100%;background:#b8f53c;border-radius:999px}
.bar.b2>i{background:#38bdf8}.bar.b3>i{background:#fbbf24}.bar.b4>i{background:#a78bfa}
.rows{display:flex;flex-direction:column;gap:9px}
.row{display:grid;grid-template-columns:1fr 84px 56px;gap:10px;align-items:center;font-size:12.5px}
.row .name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e4e4e7;font-weight:600}
.row .v{text-align:right;color:#a1a1aa;font-variant-numeric:tabular-nums;font-weight:700}
.row .p{text-align:right;color:#71717a;font-size:11.5px;font-variant-numeric:tabular-nums}
.note{border:1px solid rgba(251,191,36,.35);background:rgba(251,191,36,.08);border-radius:14px;padding:13px 15px;font-size:12.5px;color:#fde68a;margin:14px 0}
.note b{color:#fbbf24}
.note.err{border-color:rgba(251,113,133,.4);background:rgba(251,113,133,.08);color:#fecdd3}
.note.err b{color:#fb7185}
.note.ok{border-color:rgba(184,245,60,.3);background:rgba(184,245,60,.07);color:#d4ff7a}
.note.ok b{color:#b8f53c}
.tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:800;letter-spacing:.02em}
.tag.novo{background:rgba(184,245,60,.15);color:#b8f53c}
.tag.respondido{background:rgba(56,189,248,.14);color:#7dd3fc}
.tag.arquivado{background:rgba(255,255,255,.07);color:#a1a1aa}
.tag.trial{background:rgba(251,191,36,.14);color:#fbbf24}
.tag.pago{background:rgba(184,245,60,.15);color:#b8f53c}
.tag.morto{background:rgba(251,113,133,.13);color:#fb7185}
.tag.teste{background:rgba(56,189,248,.15);color:#7dd3fc}
.inp{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:11px;padding:9px 12px;color:#fafafa;font-size:12.5px;font-family:inherit;min-width:210px}
.inp::placeholder{color:#52525b}
.inp:focus{outline:none;border-color:rgba(184,245,60,.55)}
.msg{border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 15px;margin-bottom:10px;background:rgba(255,255,255,.025)}
.msg summary{cursor:pointer;list-style:none;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.msg summary::-webkit-details-marker{display:none}
.msg .who{font-weight:800;color:#fafafa}
.msg .mail{color:#a1a1aa;font-size:12px}
.msg .body{margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06);white-space:pre-wrap;font-size:13px;color:#d4d4d8;line-height:1.6}
.msg .meta{margin-top:10px;font-size:11px;color:#71717a;display:flex;flex-wrap:wrap;gap:10px}
.btn{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#e4e4e7;font-weight:700;font-size:11.5px;padding:6px 11px;border-radius:10px;cursor:pointer;font-family:inherit}
.btn:hover{border-color:rgba(184,245,60,.5);color:#b8f53c}
.btn.pri{background:#b8f53c;border-color:#b8f53c;color:#08090c}
.btn.dan{border-color:rgba(251,113,133,.4);color:#fb7185}
.actions{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}
form.inline{display:inline}
.chart{width:100%;height:auto;display:block}
.chart .grid-l{stroke:rgba(255,255,255,.06)}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:11.5px;color:#a1a1aa}
.legend i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px}
.empty{padding:26px 14px;text-align:center;color:#71717a;font-size:12.5px}
.empty b{display:block;color:#a1a1aa;font-size:13.5px;margin-bottom:5px}
footer.foot{margin-top:26px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07);font-size:11px;color:#52525b;display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between}
.login{max-width:400px;margin:8vh auto;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:28px}
.login h1{font-size:19px;margin-bottom:6px}
.login p{font-size:12.5px;color:#a1a1aa;margin-bottom:18px}
.login input{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:13px 14px;color:#fafafa;font-size:14px;font-family:inherit;margin-bottom:10px}
.login button{width:100%;background:#b8f53c;color:#08090c;font-weight:800;border:0;border-radius:12px;padding:13px;font-size:14px;cursor:pointer;font-family:inherit}
.login .hint{margin-top:14px;font-size:11px;color:#71717a;line-height:1.6}
code{background:rgba(255,255,255,.07);padding:1px 6px;border-radius:6px;font-size:11.5px}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.small{font-size:11.5px;color:#71717a}
`;

export function layout(opts: {
  title: string;
  active?: string;
  tabs?: { id: string; label: string; href: string }[];
  ranges?: { days: number; label: string; href: string; on?: boolean }[];
  children: string;
}): string {
  const tabs = opts.tabs?.length
    ? `<nav class="tabs">${opts.tabs
        .map(
          (t) =>
            `<a class="tab ${opts.active === t.id ? "on" : ""}" href="${esc(t.href)}">${esc(t.label)}</a>`,
        )
        .join("")}${
        opts.ranges?.length
          ? `<div class="ranges">${opts.ranges
              .map((r) => `<a class="chip ${r.on ? "on" : ""}" href="${esc(r.href)}">${esc(r.label)}</a>`)
              .join("")}</div>`
          : ""
      }</nav>`
    : "";
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${esc(opts.title)} · GiroLucro</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="brand">
      <div class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="#08090c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-4.5 6-6"/><path d="M17 7h3v3"/></svg></div>
      <div>
        <h1>Giro<span>Lucro</span> — painel</h1>
        <div class="sub">${esc(opts.title)}</div>
      </div>
    </div>
    <div class="actions"><a class="btn" href="/">Abrir o app →</a></div>
  </header>
  ${tabs}
  ${opts.children}
</div>
</body>
</html>`;
}

export function card(title: string, body: string, right?: string): string {
  return `<section class="card"><h2><span>${esc(title)}</span>${right ? `<em>${right}</em>` : ""}</h2>${body}</section>`;
}

export function kpi(label: string, value: string, delta?: string): string {
  return `<div class="card kpi"><span class="lbl">${esc(label)}</span><span class="val">${value}</span>${
    delta ? `<span class="dlt">${delta}</span>` : ""
  }</div>`;
}

/** Linhas com barra proporcional (top páginas, canais, dispositivos...). */
export function barRows(
  items: { label: string; value: number; hint?: string; barClass?: string }[],
  emptyText = "Ainda sem dados no período.",
): string {
  if (!items.length) return `<div class="empty">${esc(emptyText)}</div>`;
  const max = Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  return `<div class="rows">${items
    .map(
      (i) => `<div class="row">
        <span class="name" title="${esc(i.label)}">${esc(i.label)}${
          i.hint ? ` <span class="small">· ${esc(i.hint)}</span>` : ""
        }</span>
        <span class="bar ${i.barClass ?? ""}"><i style="width:${Math.max(3, (i.value / max) * 100)}%"></i></span>
        <span class="p">${((i.value / total) * 100).toFixed(0)}%</span>
      </div>`,
    )
    .join("")}</div>`;
}

export function table(headers: string[], rows: string[][]): string {
  return `<div style="overflow-x:auto"><table><thead><tr>${headers
    .map((h, i) => `<th class="${i === 0 ? "" : "num"}">${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr>${r
          .map((c, i) => `<td class="${i === 0 ? "" : "num"}">${c}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
}

/**
 * Gráfico de barras em SVG (visitas) com linha de cadastros por cima.
 * Desenha em viewBox 720×H e escala junto — continua legível no celular.
 */
export function visitsChart(
  points: { day: string; label: string; views: number; visitors: number; signups: number }[],
  labels: { barUnit?: string; peopleUnit?: string; maxLabel?: string } = {},
): string {
  const barUnit = labels.barUnit ?? "visita";
  const peopleUnit = labels.peopleUnit ?? "pessoa";
  const plural = (unit: string, value: number) => `${value} ${unit}${value === 1 ? "" : "s"}`;
  if (!points.length) return `<div class="empty">Sem visitas no período.</div>`;
  const W = 720;
  const H = 190;
  const padB = 26;
  const padT = 12;
  const max = Math.max(...points.map((p) => p.views), 1);
  const step = W / points.length;
  const bw = Math.max(3, Math.min(34, step * 0.55));
  const plotH = H - padB - padT;
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const gridLines = [0.25, 0.5, 0.75, 1]
    .map((f) => `<line class="grid-l" x1="0" x2="${W}" y1="${(padT + plotH * (1 - f)).toFixed(1)}" y2="${(
      padT +
      plotH * (1 - f)
    ).toFixed(1)}" />`)
    .join("");

  const bars = points
    .map((p, i) => {
      const x = i * step + (step - bw) / 2;
      const h = Math.max(2, plotH - (y(p.views) - padT));
      return `<rect x="${x.toFixed(1)}" y="${(padT + plotH - h).toFixed(1)}" width="${bw.toFixed(
        1,
      )}" height="${h.toFixed(1)}" rx="3" fill="#b8f53c" opacity="0.85"><title>${esc(
        p.label,
      )}: ${plural(barUnit, p.views)} · ${plural(peopleUnit, p.visitors)}</title></rect>`;
    })
    .join("");

  const signups = points
    .map((p, i) => {
      if (!p.signups) return "";
      const cx = i * step + step / 2;
      const cy = padT + plotH - (p.signups / Math.max(1, max)) * plotH * 0.9;
      return `<circle cx="${cx.toFixed(1)}" cy="${Math.max(padT + 4, cy).toFixed(1)}" r="3.6" fill="#38bdf8" stroke="#050608" stroke-width="1.4"><title>${esc(
        p.label,
      )}: ${plural("cadastro", p.signups)}</title></circle>`;
    })
    .join("");

  const every = Math.ceil(points.length / 12);
  const axisLabels = points
    .map((p, i) =>
      i % every === 0
        ? `<text x="${(i * step + step / 2).toFixed(1)}" y="${H - 8}" fill="#52525b" font-size="9.5" text-anchor="middle" font-weight="700">${esc(
            p.label,
          )}</text>`
        : "",
    )
    .join("");

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Visitas por dia">
    ${gridLines}${bars}${signups}${axisLabels}
  </svg>
  <div class="legend"><span><i style="background:#b8f53c"></i>visualizações de página</span><span><i style="background:#38bdf8"></i>contas criadas</span><span class="small">${esc(labels.maxLabel ?? `máx. ${max}/dia`)} · passe o mouse nas barras para ver os números</span></div>`;
}

export function note(kind: "info" | "ok" | "warn" | "err", title: string, body: string): string {
  const cls = kind === "ok" ? "note ok" : kind === "err" ? "note err" : kind === "warn" ? "note" : "note";
  return `<div class="${cls}"><b>${esc(title)}</b><div style="margin-top:4px">${body}</div></div>`;
}

export function loginPage(error?: string): string {
  return layout({
    title: "Acesso restrito",
    children: `<div class="login">
      <h1>Painel do <span style="color:#b8f53c">GiroLucro</span></h1>
      <p>Acompanhe acessos, visitas, cadastros e assinantes. Precisa do token de administrador (a variável <code>ADMIN_SETUP_TOKEN</code> da Vercel).</p>
      ${error ? `<div class="note err" style="margin:0 0 14px"><b>Token incorreto.</b><div style="margin-top:4px">Confira a variável <code>ADMIN_SETUP_TOKEN</code> definida no deploy.</div></div>` : ""}
      <form method="POST" action="/admin">
        <input type="password" name="token" placeholder="Token de administrador" autofocus autocomplete="current-password" />
        <button type="submit">Entrar no painel</button>
      </form>
      <p class="hint">Se preferir não digitar nada, abra <code>/admin?token=SEU_TOKEN</code> — o painel também aceita o token na URL. A sessão expira sozinha em algumas horas.</p>
    </div>`,
  });
}
