import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  await db
    .delete(expenses)
    .where(and(eq(expenses.id, n), eq(expenses.userId, user.id)));
  return NextResponse.json({ ok: true });
}
