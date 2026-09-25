import { NextResponse } from "next/server";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { normalizeStationName } from "@/lib/fuel";

export const dynamic = "force-dynamic";

const TYPES = [
  "combustivel",
  "alimentacao",
  "borracharia",
  "equipamento",
  "manutencao",
  "outro",
];

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json();
    const amount = Number(body.amount);
    const date = String(body.date ?? "");
    const type = String(body.type ?? "");
    const odometer =
      body.odometer === null || body.odometer === undefined || body.odometer === ""
        ? null
        : Number(body.odometer);
    const note = typeof body.note === "string" ? body.note.slice(0, 120) : null;
    // posto e litros só fazem sentido no combustível
    const station =
      type === "combustivel" ? normalizeStationName(body.station) : null;
    const liters =
      type === "combustivel" &&
      body.liters !== null &&
      body.liters !== undefined &&
      body.liters !== ""
        ? Number(body.liters)
        : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }
    if (!TYPES.includes(type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
    if (liters !== null && (!Number.isFinite(liters) || liters <= 0 || liters > 500)) {
      return NextResponse.json({ error: "Litros inválidos" }, { status: 400 });
    }

    const [row] = await db
      .insert(expenses)
      .values({
        userId: user.id,
        date,
        type,
        amount: Math.round(amount * 100) / 100,
        odometer,
        station,
        liters: liters === null ? null : Math.round(liters * 100) / 100,
        note,
      })
      .returning();
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error("[expenses] POST:", error);
    return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 });
  }
}
