import { NextResponse } from "next/server";
import { db } from "@/db";
import { maintenances } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TYPES = ["oleo", "pneus", "freios", "relacao", "revisao", "outro"];

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json();
    const date = String(body.date ?? "");
    const type = String(body.type ?? "");
    const kmDone = Number(body.kmDone);
    const cost = Number(body.cost ?? 0);
    const intervalKm = Number(body.intervalKm ?? 0);
    const note = typeof body.note === "string" ? body.note.slice(0, 120) : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }
    if (!TYPES.includes(type)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    }
    if (!Number.isFinite(kmDone) || kmDone < 0 || kmDone > 10_000_000) {
      return NextResponse.json({ error: "Km inválido" }, { status: 400 });
    }

    const [row] = await db
      .insert(maintenances)
      .values({
        userId: user.id,
        date,
        type,
        kmDone: Math.round(kmDone * 10) / 10,
        cost: Math.round(cost * 100) / 100,
        intervalKm: Math.max(0, Math.round(intervalKm)),
        note,
      })
      .returning();
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 });
  }
}
