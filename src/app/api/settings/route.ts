import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json();
    const num = (v: unknown, min: number, max: number, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };

    const current = await getSettings(user.id);

    const patch = {
      vehicleType: ["carro", "moto"].includes(body.vehicleType)
        ? body.vehicleType
        : current.vehicleType,
      vehicleName:
        typeof body.vehicleName === "string"
          ? body.vehicleName.slice(0, 40)
          : current.vehicleName,
      kmPerLiter: num(body.kmPerLiter, 1, 100, current.kmPerLiter),
      fuelPrice: num(body.fuelPrice, 0.5, 30, current.fuelPrice),
      maintenancePerKm: num(body.maintenancePerKm, 0, 5, current.maintenancePerKm),
      fuelMode: ["estimate", "actual"].includes(body.fuelMode)
        ? body.fuelMode
        : current.fuelMode,
      monthlyRent: num(body.monthlyRent, 0, 100000, current.monthlyRent),
      monthlyPhone: num(body.monthlyPhone, 0, 100000, current.monthlyPhone),
      monthlyInsurance: num(body.monthlyInsurance, 0, 100000, current.monthlyInsurance),
      monthlyGoal: num(body.monthlyGoal, 0, 1000000, current.monthlyGoal),
      workDaysPerWeek: Math.round(
        num(body.workDaysPerWeek, 1, 7, current.workDaysPerWeek),
      ),
      reservePercent: num(body.reservePercent, 0, 50, current.reservePercent),
      initialOdometer: num(body.initialOdometer, 0, 10_000_000, current.initialOdometer),
      updatedAt: new Date(),
    };

    const [row] = await db
      .update(settings)
      .set(patch)
      .where(eq(settings.userId, user.id))
      .returning();
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 });
  }
}
