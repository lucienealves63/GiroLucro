import { NextResponse } from "next/server";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { workEntries } from "@/db/schema";
import { formatDateStr } from "@/lib/format";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PLATFORMS = ["uber", "99", "ifood", "rappi", "direto", "outro"];

/**
 * Marca como recebidos os repasses pendentes de uma plataforma
 * (até a data informada; padrão: hoje).
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const platform = String(body.platform ?? "");
    const until =
      typeof body.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.until)
        ? body.until
        : formatDateStr(new Date());

    if (platform !== "all" && !PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: "Plataforma inválida" }, { status: 400 });
    }

    const where =
      platform === "all"
        ? and(
            eq(workEntries.settled, false),
            eq(workEntries.userId, user.id),
            lte(workEntries.date, until),
          )
        : and(
            eq(workEntries.settled, false),
            eq(workEntries.userId, user.id),
            eq(workEntries.platform, platform),
            lte(workEntries.date, until),
          );

    const updated = await db
      .update(workEntries)
      .set({ settled: true })
      .where(where)
      .returning({ id: workEntries.id });

    return NextResponse.json({ ok: true, settled: updated.length });
  } catch {
    return NextResponse.json({ error: "Falha ao baixar repasse" }, { status: 500 });
  }
}
