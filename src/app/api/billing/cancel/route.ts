import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Cancela a renovação automática: o usuário mantém acesso até o fim do
 * período já pago e depois perde o acesso (volta para a tela de assinatura).
 * Com gateway real, aqui também se cancela a assinatura no provedor.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  await db
    .update(users)
    .set({ planStatus: "canceled", planCycle: null })
    .where(eq(users.id, user.id));

  return NextResponse.json({ ok: true });
}
