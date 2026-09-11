import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { LandingClient } from "@/components/landing-client";
import { getSessionUser, hasAccess, trialDaysLeft } from "@/lib/auth";
import {
  buildInsights,
  computeDay,
  computeRange,
  currentOdometer,
  dailyGoal,
  maintenanceStatuses,
} from "@/lib/calculations";
import { getAppData } from "@/lib/data";
import {
  EXPENSE_META,
  brl,
  hrs,
  km as fmtKm,
  last7Days,
  timeAgo,
  todayStr,
  weekdayShort,
} from "@/lib/format";
import { parsePlatformsJson, resolvePlatformMeta } from "@/lib/platforms";
import type { DashboardVM, RecentItem } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();

  // Visitante não logado → landing pública (conversão)
  if (!user) {
    return <LandingClient isLogged={false} />;
  }

  // Logado mas sem acesso (trial expirado / sem plano) → paywall
  if (!hasAccess(user)) {
    redirect("/assinatura");
  }
  const data = await getAppData(user.id);
  const today = todayStr();
  const s = data.settings;
  const platforms = parsePlatformsJson(s.platformsJson);

  const hasAny = data.entries.length > 0 || data.expenses.length > 0;
  const todayStats = computeDay(today, data.entries, data.expenses, s);
  const week = computeRange(last7Days(today), data.entries, data.expenses, s);
  const wdpm = s.workDaysPerWeek * 4.345;
  const goal = dailyGoal(s);

  const odo = currentOdometer(s, data.entries, data.expenses);
  const alerts = maintenanceStatuses(data.maintenances, odo).filter(
    (m) => m.status === "atencao" || m.status === "urgente" || m.status === "vencido",
  );
  alerts.sort((a, b) => a.remainingKm - b.remainingKm);

  const recents: RecentItem[] = [
    ...data.entries.map((e) => {
      const meta = resolvePlatformMeta(e.platform, platforms);
      const unit = meta.unit;
      return {
        id: e.id,
        kind: "entry" as const,
        label: `${meta.label}${e.quantity > 1 ? ` · ${e.quantity} ${unit}s` : ""}`,
        sub: `${hrs(e.hours)} · ${fmtKm(e.km)}${e.waitMinutes > 0 ? ` · ${Math.round(e.waitMinutes)}min espera` : ""}${!e.settled ? " · a receber" : ""}`,
        amount: e.gross,
        positive: true,
        platform: e.platform,
        when: timeAgo(e.date, today),
        createdAt: new Date(e.createdAt).getTime(),
      };
    }),
    ...data.expenses.map((x) => ({
      id: x.id,
      kind: "expense" as const,
      label: EXPENSE_META[x.type]?.label ?? "Gasto",
      sub: x.note ?? "",
      amount: x.amount,
      positive: false,
      platform: x.type,
      when: timeAgo(x.date, today),
      createdAt: new Date(x.createdAt).getTime(),
    })),
  ]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8);

  const repassPending = data.entries
    .filter((e) => !e.settled)
    .reduce((a, e) => a + e.gross, 0);

  const vm: DashboardVM = {
    today,
    firstName: user.name.split(" ")[0],
    trialDaysLeft: trialDaysLeft(user),
    dateLabel: new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(today + "T12:00:00")),
    hasAny,
    todayStats,
    goal,
    goalPct: goal > 0 ? todayStats.net / goal : 0,
    repassPending,
    reserveToday: todayStats.net > 0 ? (todayStats.net * s.reservePercent) / 100 : 0,
    reservePct: s.reservePercent,
    week: week.days.map((d) => ({
      label: weekdayShort(d.date),
      net: d.net,
      gross: d.gross,
      isToday: d.date === today,
      hasData: d.gross > 0 || d.food > 0 || d.other > 0 || d.fuelActual > 0,
    })),
    weekNet: week.net,
    alerts: alerts.slice(0, 3).map((a) => ({
      label: a.label,
      remainingKm: a.remainingKm,
      status: a.status,
    })),
    insights: buildInsights(today, data.entries, data.expenses, s),
    recents,
    fuelMode: s.fuelMode,
    fixedToday: todayStats.fixedShare,
    monthFixedLabel: brl(s.monthlyRent + s.monthlyPhone + s.monthlyInsurance),
    daysWorked: Math.round(wdpm),
    upcomingEmpty: !hasAny,
  };

  return <Dashboard vm={vm} />;
}
