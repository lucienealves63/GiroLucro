import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  return NextResponse.json({
    planStatus: user.planStatus,
    planCycle: user.planCycle,
    currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
  });
}
