import { MaintenanceClient } from "@/components/maintenance";
import { requireUser } from "@/lib/auth";
import { computeRange, currentOdometer, maintenanceStatuses } from "@/lib/calculations";
import { getAppData } from "@/lib/data";
import { addDaysStr, fullDate, monthOf, todayStr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ManutencaoPage() {
  const user = await requireUser({ needsAccess: true });
  const data = await getAppData(user.id);
  const today = todayStr();
  const s = data.settings;

  const odo = currentOdometer(s, data.entries, data.expenses);
  const statuses = maintenanceStatuses(data.maintenances, odo);

  const thisMonth = monthOf(today);
  const monthMaintSpent = data.maintenances
    .filter((m) => monthOf(m.date) === thisMonth)
    .reduce((a, m) => a + m.cost, 0);
  const range30 = computeRange(
    Array.from({ length: 30 }, (_, i) => addDaysStr(today, i - 29)),
    data.entries,
    data.expenses,
    s,
  );

  const history = data.maintenances
    .slice(0, 12)
    .map((m) => ({
      id: m.id,
      type: m.type,
      date: m.date,
      dateLabel: fullDate(m.date),
      kmDone: m.kmDone,
      cost: m.cost,
    }));

  return (
    <MaintenanceClient
      today={today}
      odometer={odo}
      vehicleLabel={
        s.vehicleName
          ? `${s.vehicleType === "moto" ? "Moto" : "Carro"} · ${s.vehicleName}`
          : s.vehicleType === "moto"
            ? "Moto"
            : "Carro"
      }
      statuses={statuses.map((st) => ({
        type: st.type,
        label: st.label,
        hasRecord: st.hasRecord,
        kmDone: st.kmDone,
        cost: st.cost,
        intervalKm: st.intervalKm,
        remainingKm: st.remainingKm,
        pct: st.pct,
        status: st.status,
      }))}
      monthMaintSpent={monthMaintSpent}
      monthProvision={range30.maintProv}
      history={history}
    />
  );
}
