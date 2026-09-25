import { pool } from "@/db";
import { dayKey, dayRange, pageLabel, weekdayOf } from "@/lib/analytics";
import { DEFAULT_PLAN } from "@/lib/billing";

/**
 * Consultas agregadas do painel /admin.
 *
 * Tudo em SQL direto no `pool` (mesma conexão do resto do app): as
 * agregações de série diária ficam mais legíveis assim do que montadas no
 * client. Todas as queries usam parâmetros ($1, $2…) — nada de string
 * interpolada — e toleram tabela inexistente (a UI mostra o aviso de setup).
 */

export type SeriesPoint = {
  day: string;
  label: string;
  views: number;
  visitors: number;
  sessions: number;
  signups: number;
};

export type NamedCount = { label: string; value: number; visitors?: number; hint?: string };

export type VisitReport = {
  views: number;
  visitors: number;
  sessions: number;
  avgDwellMs: number;
  avgPagesPerVisit: number;
  bounceRate: number; // 0..1
  botViews: number;
  authedViews: number;
  lastViewAt: string | null;
  series: SeriesPoint[];
  topPages: NamedCount[];
  channels: NamedCount[];
  referrers: NamedCount[];
  campaigns: NamedCount[];
  devices: NamedCount[];
  browsers: NamedCount[];
  countries: NamedCount[];
  entryPages: NamedCount[];
  exitPages: NamedCount[];
  hours: { hour: number; views: number }[];
  weekdays: { dow: number; label: string; views: number; avg: number }[];
  prev: { views: number; visitors: number; sessions: number };
};

export type SubscriberReport = {
  total: number;
  newInPeriod: number;
  prevNew: number;
  trialsActive: number;
  trialsExpired: number;
  trialsEndingSoon: number;
  paying: number;
  canceled: number;
  pendingPayment: number;
  revenue: number;
  signupRate: number; // visitantes únicos → conta
  paidRate: number; // contas → pagantes
  activeLast7: number; // assinantes que abriram o app nos últimos 7 dias
  byStatus: NamedCount[];
  series: { day: string; label: string; signups: number; paid: number }[];
  recent: {
    id: number;
    name: string;
    email: string;
    createdDay: string;
    statusLabel: string;
    statusClass: string;
    channel: string;
    referrer: string;
    entryPath: string;
    /** Conta de teste: fora dos números, marcada na lista com etiqueta própria. */
    isTest: boolean;
  }[];
  attribution: NamedCount[];
  topLandingPages: NamedCount[];
  /** Contas de teste cadastradas (fora de todos os números acima). */
  testAccounts: {
    id: number;
    name: string;
    email: string;
    createdDay: string;
    planLabel: string;
  }[];
  testTotal: number;
};

export type ContactRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  topic: string;
  body: string;
  status: string;
  createdAt: string;
  emailSent: boolean;
  emailError: string | null;
  sourcePath: string | null;
  replyToEmail: boolean;
  userId: number | null;
};

export type RefundRow = {
  userId: number;
  name: string;
  email: string;
  paymentId: string | null;
  provider: string | null;
  paymentStatus: string | null;
  amount: number | null;
  paidAt: string | null;
  refundStatus: string | null;
  requestedAt: string | null;
  daysSincePurchase: number | null;
  withinWindow: boolean;
};

export type DataRequestRow = {
  id: number;
  requestType: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export type RequestReport = {
  /** Pedidos de reembolso (fila manual + histórico recente). */
  refunds: RefundRow[];
  /** Quantos ainda dependem de ação da equipe. */
  refundsPending: number;
  /** Solicitações de titular registradas (LGPD). */
  dataRequests: DataRequestRow[];
};

export type Report = {
  ok: boolean;
  problems: string[]; // avisos de setup (tabela faltando etc.)
  range: { days: number; from: string; to: string; label: string };
  visits: VisitReport | null;
  subscribers: SubscriberReport;
  contact: { unread: number; total: number; rows: ContactRow[] };
  requests: RequestReport;
};

const int = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};
const flt = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function query(text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  const res = await pool.query(text, params as never[]);
  return res.rows;
}

async function tableExists(name: string): Promise<boolean> {
  try {
    const r = await pool.query("SELECT to_regclass($1) AS reg", [`public.${name}`]);
    return !!r.rows[0]?.reg;
  } catch {
    return false;
  }
}

/** paid = acesso pago ativo (pagamento único tem current_period_end ~2100). */
const PAID_SQL = `(u.plan_status IN ('active','canceled') AND u.current_period_end > now())`;

/**
 * Contas de teste (`users.is_test`) ficam fora de TODA estatística de negócio:
 * cadastros, conversão, pagantes, receita e funil. Elas têm uma lista própria
 * no painel (aba Pagantes) e são identificadas nas listas de contas.
 */
const REAL_USERS_SQL = `u.is_test = false`;

export async function buildReport(days: number): Promise<Report> {
  const daysSafe = Math.max(3, Math.min(180, Math.round(days)));
  const range = dayRange(daysSafe);
  const from = range[0];
  const to = range[range.length - 1];
  const prevFrom = dayRange(daysSafe * 2)[0];

  const problems: string[] = [];
  const hasViews = await tableExists("page_views");
  const hasMessages = await tableExists("contact_messages");
  if (!hasViews) problems.push("tabela:page_views");
  if (!hasMessages) problems.push("tabela:contact_messages");

  const [views, bots, visits, sessionsAgg, topPages, channels, referrers, campaigns, devices, browsers, countries, entry, exit, hours, weekdays, signupSeries, prevSignup] =
    await Promise.all([
      hasViews
        ? query(
            `SELECT count(*)::int AS views,
                    count(DISTINCT visitor_id)::int AS visitors,
                    count(DISTINCT session_id)::int AS sessions,
                    coalesce(avg(dwell_ms), 0)::float8 AS avg_dwell,
                    count(*) FILTER (WHERE user_id IS NOT NULL)::int AS authed,
                    max(created_at) AS last_at
               FROM page_views WHERE day >= $1 AND day <= $2 AND is_bot = false`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(`SELECT count(*)::int AS n FROM page_views WHERE day >= $1 AND day <= $2 AND is_bot`, [
            from,
            to,
          ])
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(
            `SELECT day,
                    count(*)::int AS views,
                    count(DISTINCT visitor_id)::int AS visitors,
                    count(DISTINCT session_id)::int AS sessions
               FROM page_views WHERE day >= $1 AND day <= $2 AND is_bot = false
              GROUP BY day ORDER BY day`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(
            `WITH s AS (
                SELECT session_id, count(*)::int AS pages, coalesce(sum(dwell_ms), 0)::int AS dwell
                  FROM page_views WHERE day >= $1 AND day <= $2 AND is_bot = false
                 GROUP BY session_id)
             SELECT count(*)::int AS sessions,
                    count(*) FILTER (WHERE s.pages = 1)::int AS bounces,
                    coalesce(avg(s.pages), 0)::float8 AS avg_pages,
                    coalesce(avg(s.dwell), 0)::float8 AS avg_dwell
               FROM s`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(
            `SELECT path, count(*)::int AS views, count(DISTINCT visitor_id)::int AS visitors,
                    coalesce(avg(dwell_ms), 0)::float8 AS avg_dwell
               FROM page_views WHERE day >= $1 AND day <= $2 AND is_bot = false
              GROUP BY path ORDER BY views DESC LIMIT 12`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(
            `SELECT coalesce(channel, 'direto') AS k, count(*)::int AS views,
                    count(DISTINCT visitor_id)::int AS visitors
               FROM page_views WHERE day >= $1 AND day <= $2 AND is_bot = false
              GROUP BY 1 ORDER BY views DESC`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(
            `SELECT coalesce(referrer_domain, 'acesso direto') AS k, count(*)::int AS views,
                    count(DISTINCT visitor_id)::int AS visitors
               FROM page_views WHERE day >= $1 AND day <= $2 AND is_bot = false AND channel <> 'interno'
              GROUP BY 1 ORDER BY views DESC LIMIT 10`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(
            `SELECT coalesce(source, '—') AS k, coalesce(campaign, 'sem campanha') AS c,
                    count(*)::int AS views, count(DISTINCT visitor_id)::int AS visitors,
                    count(*) FILTER (WHERE user_id IS NOT NULL)::int AS converted
               FROM page_views
              WHERE day >= $1 AND day <= $2 AND is_bot = false AND (source IS NOT NULL OR campaign IS NOT NULL)
              GROUP BY 1, 2 ORDER BY views DESC LIMIT 8`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(
            `SELECT coalesce(device_type, 'desktop') AS k, count(*)::int AS views,
                    count(DISTINCT visitor_id)::int AS visitors
               FROM page_views WHERE day >= $1 AND day <= $2 AND is_bot = false
              GROUP BY 1 ORDER BY views DESC`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(
            `SELECT coalesce(browser, 'Outro') AS k, count(*)::int AS views
               FROM page_views WHERE day >= $1 AND day <= $2 AND is_bot = false
              GROUP BY 1 ORDER BY views DESC LIMIT 6`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(
            `SELECT coalesce(country, '—') AS k, count(*)::int AS views,
                    count(DISTINCT visitor_id)::int AS visitors
               FROM page_views WHERE day >= $1 AND day <= $2 AND is_bot = false
              GROUP BY 1 ORDER BY views DESC LIMIT 8`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(
            `WITH f AS (
                SELECT DISTINCT ON (session_id) session_id, path
                  FROM page_views WHERE day >= $1 AND day <= $2 AND is_bot = false
                 ORDER BY session_id, created_at, id)
             SELECT path, count(*)::int AS views FROM f GROUP BY path ORDER BY views DESC LIMIT 6`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(
            `WITH l AS (
                SELECT DISTINCT ON (session_id) session_id, path
                  FROM page_views WHERE day >= $1 AND day <= $2 AND is_bot = false
                 ORDER BY session_id, created_at DESC, id DESC)
             SELECT path, count(*)::int AS views FROM l GROUP BY path ORDER BY views DESC LIMIT 6`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(
            `SELECT to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'HH24')::int AS h,
                    count(*)::int AS views
               FROM page_views WHERE day >= $1 AND day <= $2 AND is_bot = false
              GROUP BY 1 ORDER BY 1`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      hasViews
        ? query(
            `SELECT day, count(*)::int AS views FROM page_views
              WHERE day >= $1 AND day <= $2 AND is_bot = false GROUP BY day`,
            [from, to],
          )
        : Promise.resolve([] as Record<string, unknown>[]),
      query(
        `SELECT to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day,
                count(*)::int AS signups,
                count(*) FILTER (WHERE ${PAID_SQL})::int AS paid
           FROM users u
          WHERE created_at >= (current_date - ($1::int * 2 + 3) * interval '1 day')
            AND ${REAL_USERS_SQL}
          GROUP BY 1`,
        [daysSafe],
      ),
      query(
        `SELECT count(*)::int AS n FROM users u
          WHERE u.created_at::date >= (CURRENT_DATE - $1::int) AND u.created_at::date < (CURRENT_DATE - $1::int)
            AND ${REAL_USERS_SQL}`,
        [daysSafe],
      ).catch(() => [{ n: 0 }]),
    ]);

  const today = dayKey();
  const signupByDay = new Map<string, { signups: number; paid: number }>();
  for (const r of signupSeries) {
    signupByDay.set(String(r.day), { signups: int(r.signups), paid: int(r.paid) });
  }

  const viewsByDay = new Map<string, { views: number; visitors: number; sessions: number }>();
  for (const r of visits) {
    viewsByDay.set(String(r.day), {
      views: int(r.views),
      visitors: int(r.visitors),
      sessions: int(r.sessions),
    });
  }

  const series: SeriesPoint[] = range.map((day) => {
    const v = viewsByDay.get(day) ?? { views: 0, visitors: 0, sessions: 0 };
    const s = signupByDay.get(day) ?? { signups: 0, paid: 0 };
    return {
      day,
      label: `${day.slice(8, 10)}/${day.slice(5, 7)}`,
      views: v.views,
      visitors: v.visitors,
      sessions: v.sessions,
      signups: s.signups,
    };
  });

  const totals = views[0] ?? {};
  const sessAgg = sessionsAgg[0] ?? {};
  const totalViews = int(totals.views);
  const totalSessions = int(sessAgg.sessions) || int(totals.sessions);
  // comparação com o período anterior (para o "desempenho")
  const prevAgg = hasViews
    ? (
        await query(
          `SELECT count(*)::int AS views, count(DISTINCT visitor_id)::int AS visitors,
                  count(DISTINCT session_id)::int AS sessions
             FROM page_views WHERE day >= $1 AND day < $2 AND is_bot = false`,
          [prevFrom, from],
        )
      )[0] ?? {}
    : {};

  const visitsReport: VisitReport = {
    views: totalViews,
    visitors: int(totals.visitors),
    sessions: totalSessions,
    avgDwellMs: flt(sessAgg.avg_dwell) || flt(totals.avg_dwell),
    avgPagesPerVisit: flt(sessAgg.avg_pages),
    bounceRate: totalSessions ? flt(sessAgg.bounces) / totalSessions : 0,
    botViews: int(bots[0]?.n),
    authedViews: int(totals.authed),
    lastViewAt: totals.last_at ? new Date(String(totals.last_at)).toISOString() : null,
    series,
    topPages: topPages.map((r) => ({
      label: pageLabel(String(r.path)),
      value: int(r.views),
      visitors: int(r.visitors),
      hint: `${Math.round(flt(r.avg_dwell) / 1000)}s médios`,
    })),
    channels: channels.map((r) => ({ label: String(r.k), value: int(r.views), visitors: int(r.visitors) })),
    referrers: referrers.map((r) => ({ label: String(r.k), value: int(r.views), visitors: int(r.visitors) })),
    campaigns: campaigns.map((r) => ({
      label: `${r.k} · ${r.c}`,
      value: int(r.views),
      visitors: int(r.visitors),
      hint: `${int(r.converted)} logados`,
    })),
    devices: devices.map((r) => ({ label: String(r.k), value: int(r.views), visitors: int(r.visitors) })),
    browsers: browsers.map((r) => ({ label: String(r.k), value: int(r.views) })),
    countries: countries.map((r) => ({ label: String(r.k), value: int(r.views), visitors: int(r.visitors) })),
    entryPages: entry.map((r) => ({ label: pageLabel(String(r.path)), value: int(r.views) })),
    exitPages: exit.map((r) => ({ label: pageLabel(String(r.path)), value: int(r.views) })),
    hours: Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      views: int(hours.find((r) => int(r.h) === h)?.views ?? 0),
    })),
    weekdays: [1, 2, 3, 4, 5, 6, 7].map((dow) => {
      const daysInRange = range.filter((d) => weekdayOf(d) === dow);
      const sum = daysInRange.reduce((a, d) => a + (viewsByDay.get(d)?.views ?? 0), 0);
      return {
        dow,
        label: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][dow % 7]!,
        views: sum,
        avg: daysInRange.length ? sum / daysInRange.length : 0,
      };
    }),
    prev: {
      views: int(prevAgg.views),
      visitors: int(prevAgg.visitors),
      sessions: int(prevAgg.sessions),
    },
  };

  /* ------------------------------- assinantes ------------------------------ */

  const stats = (
    await query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE created_at >= (CURRENT_DATE - ($1::int) * interval '1 day'))::int AS new_in_period,
              count(*) FILTER (WHERE plan_status = 'trialing' AND trial_ends_at > now())::int AS trials_active,
              count(*) FILTER (WHERE plan_status = 'trialing' AND (trial_ends_at IS NULL OR trial_ends_at <= now()))::int AS trials_expired,
              count(*) FILTER (WHERE plan_status = 'trialing' AND trial_ends_at > now() AND trial_ends_at <= now() + interval '3 days')::int AS ending_soon,
              count(*) FILTER (WHERE ${PAID_SQL})::int AS paying,
              count(*) FILTER (WHERE plan_status = 'canceled' AND NOT (${PAID_SQL}))::int AS canceled,
              count(*) FILTER (WHERE plan_status = 'pending_payment')::int AS pending
         FROM users u
        WHERE ${REAL_USERS_SQL}`,
      [daysSafe],
    )
  )[0] ?? {};

  const activeLast7 = hasViews
    ? int(
        (
          await query(
            `SELECT count(DISTINCT user_id)::int AS n FROM page_views
              WHERE user_id IS NOT NULL AND day >= to_char(now() - interval '7 days', 'YYYY-MM-DD')
                AND user_id NOT IN (SELECT id FROM users WHERE is_test = true)`,
          )
        )[0] ?? {},
      )
    : 0;

  const byStatusRows = await query(
    `SELECT plan_status AS k, count(*)::int AS n FROM users u
      WHERE ${REAL_USERS_SQL} GROUP BY 1 ORDER BY 2 DESC`,
  ).catch(() => [] as Record<string, unknown>[]);

  // Contas de teste: lista própria, fora de todos os números.
  const testRows = await query(
    `SELECT u.id, u.name, u.email, u.plan_status,
            to_char(u.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day
       FROM users u
      WHERE u.is_test = true
      ORDER BY u.created_at DESC LIMIT 50`,
  ).catch(() => [] as Record<string, unknown>[]);

  const statusLabel = (s: string): string => {
    return {
      active: "Pro ativo",
      trialing: "Em teste",
      canceled: "Cancelado",
      pending_payment: "Pagamento pendente",
    }[s] ?? s;
  };

  const recentRows = await query(
    `WITH ft AS (
        SELECT DISTINCT ON (user_id) user_id, channel, referrer_domain, path
          FROM page_views WHERE user_id IS NOT NULL AND is_bot = false
         ORDER BY user_id, created_at, id)
     SELECT u.id, u.name, u.email, u.plan_status, u.plan_cycle, u.is_test,
            to_char(u.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day,
            u.trial_ends_at, u.current_period_end,
            coalesce(ft.channel, '—') AS channel, coalesce(ft.referrer_domain, '—') AS referrer,
            ft.path AS entry_path
       FROM users u LEFT JOIN ft ON ft.user_id = u.id
      ORDER BY u.created_at DESC LIMIT 20`,
  ).catch(() => [] as Record<string, unknown>[]);

  const attributionRows = hasViews
    ? await query(
        `WITH ft AS (
            SELECT DISTINCT ON (user_id) user_id, channel
              FROM page_views WHERE user_id IS NOT NULL AND is_bot = false
             ORDER BY user_id, created_at, id)
         SELECT ft.channel AS k, count(*)::int AS signups,
                count(*) FILTER (WHERE ${PAID_SQL})::int AS paid
           FROM ft JOIN users u ON u.id = ft.user_id
          WHERE ${REAL_USERS_SQL}
          GROUP BY 1 ORDER BY 2 DESC`,
      ).catch(() => [] as Record<string, unknown>[])
    : [];

  const landingRows = hasViews
    ? await query(
        `WITH ft AS (
            SELECT DISTINCT ON (user_id) user_id, path
              FROM page_views WHERE user_id IS NOT NULL AND is_bot = false
             ORDER BY user_id, created_at, id)
         SELECT ft.path AS k, count(*)::int AS signups,
                count(*) FILTER (WHERE ${PAID_SQL})::int AS paid
           FROM ft JOIN users u ON u.id = ft.user_id
          WHERE ${REAL_USERS_SQL}
          GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
      ).catch(() => [] as Record<string, unknown>[])
    : [];

  const paying = int(stats.paying);
  const totalUsers = int(stats.total);
  const uniqueVisitors = visitsReport.visitors || 0;

  const subscribers: SubscriberReport = {
    total: totalUsers,
    newInPeriod: int(stats.new_in_period),
    prevNew: int(prevSignup[0]?.n ?? 0),
    trialsActive: int(stats.trials_active),
    trialsExpired: int(stats.trials_expired),
    trialsEndingSoon: int(stats.ending_soon),
    paying,
    canceled: int(stats.canceled),
    pendingPayment: int(stats.pending),
    revenue: paying * DEFAULT_PLAN.price,
    signupRate: uniqueVisitors ? totalUsers / uniqueVisitors : 0,
    paidRate: totalUsers ? paying / totalUsers : 0,
    activeLast7,
    byStatus: byStatusRows.map((r) => ({
      label: statusLabel(String(r.k)),
      value: int(r.n),
    })),
    series: range.map((day) => {
      const s = signupByDay.get(day) ?? { signups: 0, paid: 0 };
      return { day, label: `${day.slice(8, 10)}/${day.slice(5, 7)}`, signups: s.signups, paid: s.paid };
    }),
    recent: recentRows.map((r) => {
      const status = String(r.plan_status);
      const isTest = Boolean(r.is_test);
      const isPaid = status === "active" || (status === "canceled" && r.current_period_end && new Date(String(r.current_period_end)) > new Date());
      const isTrial =
        status === "trialing" && r.trial_ends_at && new Date(String(r.trial_ends_at)) > new Date();
      return {
        id: int(r.id),
        name: String(r.name ?? ""),
        email: String(r.email ?? ""),
        createdDay: String(r.day ?? ""),
        statusLabel: isTest
          ? "Conta de teste"
          : isPaid
            ? `Pro ${r.plan_cycle === "lifetime" ? "pagamento único" : "ativo"}`
            : isTrial
              ? "Em teste"
              : statusLabel(status),
        statusClass: isTest ? "teste" : isPaid ? "pago" : isTrial ? "trial" : "morto",
        channel: String(r.channel ?? "—"),
        referrer: String(r.referrer ?? "—"),
        entryPath: r.entry_path ? pageLabel(String(r.entry_path)) : "—",
        isTest,
      };
    }),
    testAccounts: testRows.map((r) => ({
      id: int(r.id),
      name: String(r.name ?? ""),
      email: String(r.email ?? ""),
      createdDay: String(r.day ?? ""),
      planLabel: statusLabel(String(r.plan_status)),
    })),
    testTotal: testRows.length,
    attribution: attributionRows.map((r) => ({
      label: String(r.k),
      value: int(r.signups),
      hint: `${int(r.paid)} pagantes`,
    })),
    topLandingPages: landingRows.map((r) => ({
      label: pageLabel(String(r.k)),
      value: int(r.signups),
      hint: `${int(r.paid)} pagantes`,
    })),
  };

  /* -------------------------------- contato -------------------------------- */

  let contact: Report["contact"] = { unread: 0, total: 0, rows: [] };
  if (hasMessages) {
    const agg = (
      await query(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'novo')::int AS unread FROM contact_messages`,
      )
    )[0] ?? {};
    const rows = await query(
      `SELECT id, name, email, phone, topic, body, status, email_sent, email_error,
              source_path, reply_to_email, user_id, created_at
         FROM contact_messages ORDER BY created_at DESC LIMIT 60`,
    );
    contact = {
      unread: int(agg.unread),
      total: int(agg.total),
      rows: rows.map((r) => ({
        id: int(r.id),
        name: String(r.name ?? ""),
        email: String(r.email ?? ""),
        phone: r.phone ? String(r.phone) : null,
        topic: String(r.topic ?? "duvida"),
        body: String(r.body ?? ""),
        status: String(r.status ?? "novo"),
        createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : "",
        emailSent: Boolean(r.email_sent),
        emailError: r.email_error ? String(r.email_error) : null,
        sourcePath: r.source_path ? String(r.source_path) : null,
        replyToEmail: Boolean(r.reply_to_email),
        userId: r.user_id === null ? null : int(r.user_id),
      })),
    };
  }

  /* ---------------------- pedidos de reembolso e LGPD ---------------------- */

  const requests: RequestReport = { refunds: [], refundsPending: 0, dataRequests: [] };
  try {
    const rows = await query(
      `SELECT id, name, email, payment_id, payment_provider, payment_status, payment_amount,
              paid_at, refund_status, refund_requested_at
         FROM users
        WHERE refund_status IS NOT NULL AND refund_status <> 'none'
          AND is_test = false
        ORDER BY (refund_status IN ('manual','requested','processing')) DESC,
                 coalesce(refund_requested_at, paid_at) DESC NULLS LAST
        LIMIT 60`,
    );
    requests.refunds = rows.map((r) => {
      const paidAt = r.paid_at ? new Date(String(r.paid_at)) : null;
      const status = r.refund_status ? String(r.refund_status) : null;
      const days =
        paidAt && Number.isFinite(paidAt.getTime())
          ? Math.floor((Date.now() - paidAt.getTime()) / 86_400_000)
          : null;
      return {
        userId: int(r.id),
        name: String(r.name ?? ""),
        email: String(r.email ?? ""),
        paymentId: r.payment_id ? String(r.payment_id) : null,
        provider: r.payment_provider ? String(r.payment_provider) : null,
        paymentStatus: r.payment_status ? String(r.payment_status) : null,
        amount: r.payment_amount === null ? null : flt(r.payment_amount),
        paidAt: paidAt && Number.isFinite(paidAt.getTime()) ? paidAt.toISOString() : null,
        refundStatus: status,
        requestedAt: r.refund_requested_at ? new Date(String(r.refund_requested_at)).toISOString() : null,
        daysSincePurchase: days,
        withinWindow: days !== null && days <= 7,
      };
    });
    requests.refundsPending = requests.refunds.filter((r) =>
      r.refundStatus === "manual" || r.refundStatus === "requested" || r.refundStatus === "processing",
    ).length;
  } catch (e) {
    // colunas novas ainda não migradas: o painel não pode quebrar por isso
    console.warn("[admin] pedidos de reembolso indisponíveis:", e instanceof Error ? e.message : e);
  }

  if (await tableExists("data_subject_requests")) {
    try {
      const rows = await query(
        `SELECT id, request_type, status, created_at, completed_at
           FROM data_subject_requests ORDER BY created_at DESC LIMIT 60`,
      );
      requests.dataRequests = rows.map((r) => ({
        id: int(r.id),
        requestType: String(r.request_type ?? ""),
        status: String(r.status ?? ""),
        createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : "",
        completedAt: r.completed_at ? new Date(String(r.completed_at)).toISOString() : null,
      }));
    } catch {
      /* ignora: painel continua funcionando */
    }
  }

  return {
    ok: !problems.length,
    problems,
    range: { days: daysSafe, from, to, label: today },
    visits: hasViews ? visitsReport : null,
    subscribers,
    contact,
    requests,
  };
}

/** Números brutos para integrar com o que você quiser (Sheets, Zapier…). */
export async function reportJson(days: number) {
  const report = await buildReport(days);
  return {
    geradoEm: new Date().toISOString(),
    periodo: report.range,
    problemas: report.problems,
    visitas: report.visits
      ? {
          total: report.visits.views,
          pessoasUnicas: report.visits.visitors,
          visitas: report.visits.sessions,
          tempoMedioSeg: Math.round(report.visits.avgDwellMs / 1000),
          paginasPorVisita: Number(report.visits.avgPagesPerVisit.toFixed(2)),
          taxaSalto: Number((report.visits.bounceRate * 100).toFixed(1)),
          serieDiaria: report.visits.series,
          paginas: report.visits.topPages,
          canais: report.visits.channels,
          referenciadores: report.visits.referrers,
          dispositivos: report.visits.devices,
        }
      : null,
    assinantes: report.subscribers,
    contato: { naoLidas: report.contact.unread, total: report.contact.total },
  };
}
