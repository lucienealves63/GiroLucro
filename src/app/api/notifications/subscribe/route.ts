import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Registra um novo dispositivo para receber push notifications.
 * O cliente chama isso após o SW estar registrado e o usuário clicar "Permitir notificações".
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json();
    const { subscription, userAgent } = body;

    if (!subscription?.endpoint || !subscription?.keys?.auth || !subscription?.keys?.p256dh) {
      return NextResponse.json({ error: "Subscription inválida" }, { status: 400 });
    }

    // Checa se já existe essa subscription (mesmo dispositivo/navegador)
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

    if (existing.length > 0) {
      // Atualiza se já existia
      await db
        .update(pushSubscriptions)
        .set({ userAgent, lastSentAt: new Date() })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    } else {
      // Cria nova subscription
      await db.insert(pushSubscriptions).values({
        userId: user.id,
        endpoint: subscription.endpoint,
        auth: subscription.keys.auth,
        p256dh: subscription.keys.p256dh,
        userAgent,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Subscribe error:", e);
    return NextResponse.json({ error: "Falha ao registrar notificações" }, { status: 500 });
  }
}
