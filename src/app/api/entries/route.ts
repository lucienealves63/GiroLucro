import { NextResponse } from "next/server";
import { db } from "@/db";
import { workEntries } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PLATFORMS = ["uber", "99", "ifood", "rappi", "direto", "outro"];
const PERIODS = ["madrugada", "manha", "tarde", "noite"];

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json();
    const gross = Number(body.gross);
    const hours = Number(body.hours ?? 0);
    const km = Number(body.km ?? 0);
    const date = String(body.date ?? "");
    const platform = String(body.platform ?? "");
    const period = PERIODS.includes(body.period) ? body.period : "tarde";
    const quantity = Math.round(Number(body.quantity ?? 1));
    const waitMinutes = Number(body.waitMinutes ?? 0);
    const settled = body.settled === true;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 });
    }
    if (!PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
    }
    if (!Number.isFinite(gross) || gross <= 0 || gross > 100000) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }
    if (hours < 0 || hours > 24 || km < 0 || km > 5000) {
      return NextResponse.json({ error: "Horas/km fora do limite" }, { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
      return NextResponse.json({ error: "Quantidade inválida" }, { status: 400 });
    }

    const [row] = await db
      .insert(workEntries)
      .values({
        userId: user.id,
        date,
        platform,
        gross: Math.round(gross * 100) / 100,
        hours: Math.round(hours * 100) / 100,
        km: Math.round(km * 10) / 10,
        quantity,
        waitMinutes: Math.min(1440, Math.max(0, Math.round(waitMinutes))),
        settled,
        period,
      })
      .returning();
    return NextResponse.json(row, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Falha ao salvar" }, { status: 500 });
  }
}
