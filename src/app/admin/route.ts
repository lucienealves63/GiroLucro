import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import {
  ADMIN_COOKIE,
  adminToken,
  checkAdminAccess,
  makeAdminCookieValue,
  verifyAdminFormCsrf,
} from "@/lib/admin-auth";
import { esc, layout, loginPage } from "@/lib/admin-html";
import { buildReport, reportJson, type Report } from "@/lib/admin-report";
import {
  setupNeeded,
  tabRendersSetupCallout,
  viewContact,
  viewDiagnostics,
  viewPerformance,
  viewSubscribers,
  viewVisits,
} from "@/lib/admin-views";
import { resolveRangeDays } from "@/lib/analytics";
import { getAppUrl, getAppUrlSource } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

/**
 * Painel do dono do GiroLucro: acessos, desempenho das visitas, assinantes
 * e a caixa de entrada de /contato.
 *
 *   https://SEU-DOMINIO/admin            → pede o token uma vez por dia
 *   https://SEU-DOMINIO/admin?token=...  → entra direto (mesmo token do setup)
 *   https://SEU-DOMINIO/admin?format=json → números brutos p/ planilha
 *
 * Renderização em HTML puro (route handler), como /api/admin/setup: não
 * depende de JavaScript nem do resto do app estar saudável.
 */

const TABS = [
  { id: "visitas", label: "Acessos" },
  { id: "desempenho", label: "Desempenho das visitas" },
  { id: "assinantes", label: "Assinantes" },
  { id: "contato", label: "Contato" },
  { id: "diagnostico", label: "Diagnóstico" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TITLE: Record<TabId, string> = {
  visitas: "Acessos e visitantes",
  desempenho: "Desempenho das visitas",
  assinantes: "Assinantes e conversão",
  contato: "Mensagens de contato",
  diagnostico: "Diagnóstico do painel",
};

function html(body: string, status = 200): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function redirect(req: Request, location: string): NextResponse {
  // NextResponse.redirect exige URL absoluta
  return NextResponse.redirect(new URL(location, req.url), { status: 303 });
}

function envStatus(report: Report, req: Request) {
  const tokenIsDefault = !process.env.ADMIN_SETUP_TOKEN;
  const status: Record<string, { ok: boolean; detail: string }> = {
    "Tabela page_views (visitas)": {
      ok: !report.problems.includes("tabela:page_views"),
      detail: report.problems.includes("tabela:page_views")
        ? "Não existe ainda → rode o setup abaixo. Sem ela, o painel mostra zeros."
        : "Existe e recebe os beacons do app.",
    },
    "Tabela contact_messages": {
      ok: !report.problems.includes("tabela:contact_messages"),
      detail: report.problems.includes("tabela:contact_messages")
        ? "Não existe ainda → o formulário de contato não consegue salvar."
        : "As mensagens do /contato ficam guardadas aqui.",
    },
    "Medição de visitas ao vivo": {
      ok: !!report.visits?.lastViewAt && Date.now() - Date.parse(report.visits.lastViewAt) < 7 * 86400000,
      detail: report.visits?.lastViewAt
        ? `Último acesso registrado em ${new Date(report.visits.lastViewAt).toLocaleString("pt-BR")}.`
        : "Nenhum acesso registrado ainda. Abra a landing em outra aba (ou use /api/admin/demo-visits).",
    },
    "E-mail de contato (Resend)": {
      ok: !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM,
      detail: process.env.RESEND_API_KEY
        ? "RESEND_API_KEY configurada. Falta só o remetente, se EMAIL_FROM estiver vazio."
        : "Sem RESEND_API_KEY as mensagens continuam no painel, mas você não recebe cópia no e-mail.",
    },
    "Destinatário das mensagens": {
      ok: !!process.env.CONTACT_TO_EMAIL || !!process.env.EMAIL_FROM,
      detail: process.env.CONTACT_TO_EMAIL
        ? `Cópia enviada para ${esc(process.env.CONTACT_TO_EMAIL)}.`
        : "Defina CONTACT_TO_EMAIL (ou use o EMAIL_FROM) para escolher quem recebe as mensagens.",
    },
    "ADMIN_SETUP_TOKEN personalizado": {
      ok: !tokenIsDefault,
      detail: tokenIsDefault
        ? "⚠️ Ninguém definiu ADMIN_SETUP_TOKEN — o painel está usando o valor padrão “girolucro-setup”. Troque na Vercel."
        : "Definido. Só você com o token entra no painel.",
    },
    "APP_URL (links de e-mail)": {
      ok: getAppUrlSource() !== "FALLBACK_LOCALHOST",
      detail: `Hoje: ${esc(getAppUrl(req))} (origem: ${getAppUrlSource()}).`,
    },
  };
  return status;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const access = await checkAdminAccess(req);

  // sair do painel (limpa o cookie assinado)
  if (url.searchParams.has("sair")) {
    const res = redirect(req, "/admin");
    res.cookies.set({ name: ADMIN_COOKIE, value: "", path: "/", maxAge: 0 });
    return res;
  }

  if (!access.authorized) {
    if (url.searchParams.get("format") === "json") {
      return NextResponse.json({ error: "não autorizado", hint: "?token=SEU_TOKEN" }, { status: 401 });
    }
    return html(loginPage(), 401);
  }

  const days = resolveRangeDays(url.searchParams.get("dias"));
  const tabParam = url.searchParams.get("aba");
  const tab: TabId = (TABS.find((t) => t.id === tabParam)?.id ?? "visitas") as TabId;

  if (url.searchParams.get("format") === "json") {
    return NextResponse.json(await reportJson(days), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const report = await buildReport(days);
  const tokenRaw = url.searchParams.get("token");
  // links que saem do painel para /api/admin/* exigem o token na query (essas
  // rotas não leem cookie). Sem token na URL, mantemos o placeholder p/ colar.
  const linkTokenQs = tokenRaw ? `?token=${encodeURIComponent(tokenRaw)}` : "?token=SEU_TOKEN";
  const tokenQs = linkTokenQs;
  const suffix = tokenRaw ? `&token=${encodeURIComponent(tokenRaw)}` : "";
  const hrefFor = (d: number) => `/admin?aba=${tab}&dias=${d}${suffix}`;
  const flash = url.searchParams.get("ok");

  const body =
    (flash
      ? noteOk(
          flash === "sent"
            ? "Mensagem registrada com sucesso."
            : flash === "answered"
              ? "Mensagem marcada como respondida."
              : flash === "archived"
                ? "Mensagem arquivada."
                : flash === "deleted"
                  ? "Mensagem excluída."
                  : "Feito.",
        )
      : "") +
    (report.problems.length && tab !== "diagnostico" && !tabRendersSetupCallout(tab)
      ? setupNeeded(report, tokenQs)
      : "") +
    (tab === "visitas"
      ? viewVisits(report, hrefFor, tokenQs)
      : tab === "desempenho"
        ? viewPerformance(report, tokenQs)
        : tab === "assinantes"
          ? viewSubscribers(report, tokenQs)
          : tab === "contato"
            ? viewContact(report, access.csrf, tokenRaw ?? "")
            : viewDiagnostics(envStatus(report, req), report, tokenQs));

  return html(
    layout({
      title: TITLE[tab],
      active: tab,
      tabs: TABS.map((t) => ({
        id: t.id,
        label: t.label + (t.id === "contato" && report.contact.unread ? ` (${report.contact.unread})` : ""),
        href: `/admin?aba=${t.id}&dias=${days}${suffix}`,
      })),
      ranges: [7, 30, 90].map((d) => ({
        days: d,
        label: `${d} dias`,
        href: hrefFor(d),
        on: d === days,
      })),
      children:
        body +
        `<footer class="foot"><span>GiroLucro · dados próprios, sem Google Analytics · <a href="/admin?format=json&dias=${days}${suffix}">JSON</a>${
          tokenRaw ? "" : ' · <a href="/admin?sair=1">sair</a>'
        }</span><span>período ${esc(report.range.from)} → ${esc(report.range.to)}</span></footer>`,
    }),
  );
}

function noteOk(message: string): string {
  return `<div class="note ok"><b>${esc(message)}</b></div>`;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return html(loginPage("Envie o formulário pela página do painel."), 400);
  }

  const action = String(form.get("action") ?? "login");
  const tokenQs = url.searchParams.get("token");
  const back = (flag: string) =>
    redirect(
      req,
      `/admin?aba=${encodeURIComponent(String(form.get("tab") ?? "contato"))}${
        tokenQs ? `&token=${encodeURIComponent(tokenQs)}` : ""
      }&ok=${flag}`,
    );

  // ---- login: troca o token por um cookie httpOnly ----
  if (action === "login") {
    const token = String(form.get("token") ?? "").trim();
    if (!token || token !== adminToken()) {
      return html(loginPage("Token incorreto."), 401);
    }
    const res = redirect(req, `/admin${tokenQs ? `?token=${encodeURIComponent(tokenQs)}` : ""}`);
    res.cookies.set({
      name: ADMIN_COOKIE,
      value: makeAdminCookieValue(token),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 12 * 3600,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  }

  const access = await checkAdminAccess(req);
  if (!access.authorized) return html(loginPage("Sua sessão do painel expirou — entre de novo."), 401);
  if (!verifyAdminFormCsrf(form.get("csrf") as string | null, access)) {
    return html(loginPage("Formulário expirado. Recarregue o painel e tente de novo."), 400);
  }

  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) return back("erro");

  try {
    switch (action) {
      case "answered":
        await db
          .update(contactMessages)
          .set({ status: "respondido", answeredAt: new Date() })
          .where(eq(contactMessages.id, id));
        return back("answered");
      case "reopen":
        await db.update(contactMessages).set({ status: "novo", answeredAt: null }).where(eq(contactMessages.id, id));
        return back("answered");
      case "archive":
        await db.update(contactMessages).set({ status: "arquivado" }).where(eq(contactMessages.id, id));
        return back("archived");
      case "delete":
        await db.delete(contactMessages).where(eq(contactMessages.id, id));
        return back("deleted");
      default:
        return back("erro");
    }
  } catch (e) {
    console.error("[admin] ação falhou:", e instanceof Error ? e.message : e);
    return redirect(req, `/admin?aba=contato${tokenQs ? `&token=${encodeURIComponent(tokenQs)}` : ""}&ok=erro`);
  }
}
