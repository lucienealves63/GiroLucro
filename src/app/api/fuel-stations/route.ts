import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { stationKey } from "@/lib/fuel";

export const dynamic = "force-dynamic";

/**
 * Postos já usados pelo usuário (para o preenchimento rápido no lançamento de
 * combustível). Retorna o nome mais recente de cada posto, agrupando grafias
 * diferentes pela chave normalizada.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const rows = await db
      .select({
        station: expenses.station,
        uses: sql<number>`count(*)::int`,
        lastUsed: sql<string>`max(${expenses.date})`,
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.userId, user.id),
          eq(expenses.type, "combustivel"),
          isNotNull(expenses.station),
        ),
      )
      .groupBy(expenses.station)
      .orderBy(desc(sql`count(*)`), desc(sql`max(${expenses.date})`))
      .limit(50);

    const byKey = new Map<string, { label: string; uses: number; lastUsed: string }>();
    for (const r of rows) {
      const label = (r.station ?? "").trim();
      if (!label) continue;
      const key = stationKey(label);
      const cur = byKey.get(key);
      if (!cur) {
        byKey.set(key, { label, uses: r.uses, lastUsed: r.lastUsed });
        continue;
      }
      cur.uses += r.uses;
      if (r.lastUsed > cur.lastUsed) {
        cur.lastUsed = r.lastUsed;
        cur.label = label;
      }
    }

    const stations = [...byKey.entries()]
      .map(([key, v]) => ({ key, label: v.label, uses: v.uses, lastUsed: v.lastUsed }))
      .sort((a, b) => b.uses - a.uses || (a.lastUsed < b.lastUsed ? 1 : -1))
      .slice(0, 12);

    return NextResponse.json({ stations });
  } catch {
    return NextResponse.json({ stations: [] }, { status: 500 });
  }
}
