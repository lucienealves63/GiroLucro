import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications/status — estado das notificações para a UI.
 *
 * `configured` indica se o servidor tem chaves VAPID. `devices` é quantos
 * aparelhos/navegadores deste usuário estão inscritos. Visitantes não
 * autenticados recebem `authenticated: false` e nenhum convite é exibido.
 */
export async function GET() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );

  const user = await getSessionUser().catch(() => null);
  if (!user) {
    return NextResponse.json(
      { authenticated: false, configured, devices: 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  let devices = 0;
  try {
    const rows = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.id));
    devices = rows.length;
  } catch (e) {
    console.error("[notifications] falha ao contar aparelhos:", e);
  }

  return NextResponse.json(
    { authenticated: true, configured, devices },
    { headers: { "Cache-Control": "no-store" } },
  );
}
