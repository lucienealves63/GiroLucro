import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { expenses, maintenances, settings, workEntries } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const uid = user.id;

    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "seed";

    if (action === "clear") {
      await db.delete(workEntries).where(eq(workEntries.userId, uid));
      await db.delete(expenses).where(eq(expenses.userId, uid));
      await db.delete(maintenances).where(eq(maintenances.userId, uid));
      return NextResponse.json({ ok: true, cleared: true });
    }

    // limpa antes de semear para não duplicar
    await db.delete(workEntries).where(eq(workEntries.userId, uid));
    await db.delete(expenses).where(eq(expenses.userId, uid));
    await db.delete(maintenances).where(eq(maintenances.userId, uid));

    const rnd = mulberry32(20240612);
    const between = (a: number, b: number) => a + rnd() * (b - a);
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const r1 = (v: number) => Math.round(v * 10) / 10;

    const today = new Date();
    const entryRows: (typeof workEntries.$inferInsert)[] = [];
    const expenseRows: (typeof expenses.$inferInsert)[] = [];

    let odo = 12000;
    let kmSinceFuel = 0;

    // r$/h por plataforma/período
    const rates: Record<string, Record<string, [number, number]>> = {
      uber: { manha: [22, 30], tarde: [20, 27], noite: [27, 38], madrugada: [24, 33] },
      "99": { manha: [24, 33], tarde: [19, 26], noite: [22, 31], madrugada: [21, 30] },
      ifood: { manha: [19, 26], tarde: [22, 31], noite: [25, 36], madrugada: [20, 27] },
      rappi: { manha: [18, 25], tarde: [20, 28], noite: [22, 32], madrugada: [19, 26] },
      direto: { manha: [20, 28], tarde: [22, 32], noite: [24, 35], madrugada: [20, 28] },
    };
    const DELIVERY = new Set(["ifood", "rappi", "direto"]);
    // km por entrega: rappi joga mais longe (retorno vazio)
    const kmPerDelivery: Record<string, [number, number]> = {
      ifood: [3.2, 5.2],
      rappi: [5.5, 8.5],
      direto: [2.5, 4.5],
      uber: [6, 10],
      "99": [5.5, 9],
    };

    for (let i = 23; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = formatDateStr(d);
      const dow = d.getDay();

      if (dow === 0 && i % 14 < 7 && i !== 0) continue; // algumas folgas de domingo
      const isStrong = dow === 5 || dow === 6;
      const isWeak = dow === 1;

      const nSessions = isStrong ? 3 : rnd() < 0.7 ? 2 : 1;
      const pool =
        rnd() < 0.45
          ? ["ifood", "rappi", "ifood"]
          : rnd() < 0.6
            ? ["direto", "99", "ifood"]
            : ["99", "uber", "ifood"];
      const periods =
        rnd() < 0.55 ? ["tarde", "noite", "noite"] : ["manha", "noite", "tarde"];

      for (let sIdx = 0; sIdx < nSessions; sIdx++) {
        const platform = pool[sIdx % pool.length];
        const period = periods[sIdx % periods.length];
        const hours = r2(between(1.5, isStrong ? 4.2 : 3.2));

        const [lo, hi] = rates[platform]?.[period] ?? [20, 28];
        let ratePerHour = between(lo, hi);
        if (isStrong) ratePerHour *= 1.15;
        if (isWeak) ratePerHour *= 0.82;
        const gross = r2(hours * ratePerHour);

        let quantity: number;
        let waitMinutes: number;
        let kmDriven: number;

        if (DELIVERY.has(platform)) {
          // bateria de entregas curtas
          const perHourCount = between(2.4, 3.8);
          quantity = Math.max(2, Math.round(hours * perHourCount));
          // espera em restaurante: rappi demora mais
          const waitPerDelivery = platform === "rappi" ? between(4, 9) : between(2.5, 6);
          waitMinutes = Math.round(quantity * waitPerDelivery);
          const [k1, k2] = kmPerDelivery[platform];
          kmDriven = r1(quantity * between(k1, k2));
        } else {
          quantity = Math.max(1, Math.round(hours * between(1.6, 2.6)));
          waitMinutes = Math.round(between(0, 10));
          const [k1, k2] = kmPerDelivery[platform];
          kmDriven = r1(quantity * between(k1, k2));
        }

        odo += kmDriven;
        kmSinceFuel += kmDriven;

        entryRows.push({
          userId: uid,
          date: dateStr,
          platform,
          gross,
          hours,
          km: kmDriven,
          quantity,
          waitMinutes,
          // repasses antigos já caíram; direto paga na hora
          settled: platform === "direto" || i >= 8,
          period,
        });
      }

      // combustível a cada ~150 km
      if (kmSinceFuel > 150) {
        expenseRows.push({
          userId: uid,
          date: dateStr,
          type: "combustivel",
          amount: r2(between(25, 42)),
          odometer: Math.round(odo),
        });
        kmSinceFuel = 0;
      }

      // marmita na maioria dos dias
      if (rnd() < 0.78) {
        expenseRows.push({
          userId: uid,
          date: dateStr,
          type: "alimentacao",
          amount: r2(between(14, 29)),
        });
      }
    }

    // emergências e equipamentos (específicos de quem roda de moto)
    expenseRows.push(
      {
        userId: uid,
        date: formatDateStr(new Date(today.getTime() - 16 * 86400000)),
        type: "equipamento",
        amount: 54.9,
        note: "Capa de chuva",
      },
      {
        userId: uid,
        date: formatDateStr(new Date(today.getTime() - 11 * 86400000)),
        type: "equipamento",
        amount: 34.9,
        note: "Suporte de celular",
      },
      {
        userId: uid,
        date: formatDateStr(new Date(today.getTime() - 6 * 86400000)),
        type: "borracharia",
        amount: 25,
        note: "Furo no pneu traseiro",
      },
    );

    await db.insert(workEntries).values(entryRows);
    await db.insert(expenses).values(expenseRows);

    // manutenções: óleo quase vencendo (gera alerta), freios ok, revisão antiga
    const currentKm = Math.round(odo);
    await db.insert(maintenances).values([
      {
        userId: uid,
        type: "revisao",
        date: formatDateStr(new Date(today.getTime() - 72 * 86400000)),
        kmDone: currentKm - 5400,
        cost: 240,
        intervalKm: 6000,
      },
      {
        userId: uid,
        type: "relacao",
        date: formatDateStr(new Date(today.getTime() - 50 * 86400000)),
        kmDone: currentKm - 4300,
        cost: 180,
        intervalKm: 8000,
      },
      {
        userId: uid,
        type: "freios",
        date: formatDateStr(new Date(today.getTime() - 34 * 86400000)),
        kmDone: currentKm - 2600,
        cost: 95,
        intervalKm: 5000,
      },
      {
        userId: uid,
        type: "oleo",
        date: formatDateStr(new Date(today.getTime() - 9 * 86400000)),
        kmDone: currentKm - 880,
        cost: 42,
        intervalKm: 1000,
      },
    ]);

    // settings da demo (upsert por usuário)
    const demo = {
      vehicleType: "moto",
      vehicleName: "Factor 150",
      kmPerLiter: 35,
      fuelPrice: 5.79,
      maintenancePerKm: 0.12,
      fuelMode: "estimate",
      monthlyRent: 0,
      monthlyPhone: 59.9,
      monthlyInsurance: 89,
      monthlyGoal: 3800,
      workDaysPerWeek: 6,
      reservePercent: 10,
      initialOdometer: 12000,
      updatedAt: new Date(),
    };
    await db
      .insert(settings)
      .values({ userId: uid, ...demo })
      .onConflictDoUpdate({ target: settings.userId, set: demo });

    return NextResponse.json({
      ok: true,
      entries: entryRows.length,
      expenses: expenseRows.length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Falha ao gerar dados" }, { status: 500 });
  }
}
