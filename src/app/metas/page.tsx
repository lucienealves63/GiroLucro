import { GoalsClient, type DayMark } from "@/components/goals";
import { requireUser } from "@/lib/auth";
import { computeDay, computeRange, dailyGoal, workDaysPerMonth } from "@/lib/calculations";
import { getAppData } from "@/lib/data";
import { addDaysStr, lastNDays, monthOf, todayStr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MetasPage() {
  const user = await requireUser({ needsAccess: true });
  const data = await getAppData(user.id);
  const today = todayStr();
  const s = data.settings;

  // progresso do mês
  const thisMonth = monthOf(today);
  const monthDatesSet = new Set<string>([
    ...data.entries.filter((e) => monthOf(e.date) === thisMonth).map((e) => e.date),
    ...data.expenses.filter((e) => monthOf(e.date) === thisMonth).map((e) => e.date),
  ]);
  const monthDates = [...monthDatesSet].sort();
  const month = computeRange(monthDates, data.entries, data.expenses, s);
  const goal = dailyGoal(s);

  // calendário do mês até hoje
  const year = Number(today.slice(0, 4));
  const monthNum = Number(today.slice(5, 7));
  const dayNum = Number(today.slice(8, 10));
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const calendar: DayMark[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (d > dayNum) {
      calendar.push({ day: d, status: "future" });
      continue;
    }
    const stats = computeDay(dateStr, data.entries, data.expenses, s);
    if (stats.gross <= 0) calendar.push({ day: d, status: "idle" });
    else if (stats.net >= goal) calendar.push({ day: d, status: "hit" });
    else calendar.push({ day: d, status: "miss" });
  }

  // reserva (30 dias, só dias lucrativos)
  const last30 = computeRange(lastNDays(today, 30), data.entries, data.expenses, s);
  const positiveNet = last30.days.filter((d) => d.net > 0);
  const reserveAccum = positiveNet.reduce((a, d) => a + (d.net * s.reservePercent) / 100, 0);
  const workedDays30 = last30.days.filter((d) => d.gross > 0);
  const avgDailyNet =
    workedDays30.length > 0
      ? workedDays30.reduce((a, d) => a + Math.max(0, d.net), 0) / workedDays30.length
      : 0;
  const paidDaysOff = avgDailyNet > 0 ? reserveAccum / avgDailyNet : 0;
  const vacationTarget = avgDailyNet * 7;

  const hitDays = month.days.filter((d) => d.gross > 0 && d.net >= goal).length;
  const workedDays = month.days.filter((d) => d.gross > 0).length;

  return (
    <GoalsClient
      settings={{
        monthlyGoal: s.monthlyGoal,
        workDaysPerWeek: s.workDaysPerWeek,
        reservePercent: s.reservePercent,
      }}
      dailyGoal={goal}
      daysPerMonth={workDaysPerMonth(s)}
      monthNet={month.net}
      hitDays={hitDays}
      workedDays={workedDays}
      calendar={calendar}
      reserveAccum={reserveAccum}
      avgDailyNet={avgDailyNet}
      paidDaysOff={paidDaysOff}
      vacationTarget={vacationTarget}
      hasData={data.entries.length > 0}
    />
  );
}
