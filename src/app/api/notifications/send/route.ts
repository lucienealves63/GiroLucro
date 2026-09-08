import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationLogs, pushSubscriptions } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { sendPush, type PushPayload } from "@/lib/web-push";

export const dynamic = "force-dynamic";

/** Envia teste para o próprio usuário ou, com NOTIFICATION_API_TOKEN, para outro usuário. */
export async function POST(req: Request) {
  try {
    const caller = await getSessionUser();
    const authHeader = req.headers.get("authorization") ?? "";
    const adminToken = process.env.NOTIFICATION_API_TOKEN;
    const isAdmin = !!adminToken && authHeader === `Bearer ${adminToken}`;

    if (!caller && !isAdmin) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const requestBody = await req.json();
    const requestedUserId = Number(requestBody.userId);
    const userId = isAdmin ? requestedUserId : caller!.id;

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Usuário inválido" }, { status: 400 });
    }
    if (!isAdmin && requestedUserId && requestedUserId !== caller!.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const title = String(requestBody.title ?? "").slice(0, 80);
    const bodyText = String(requestBody.body ?? "").slice(0, 240);
    if (!title || !bodyText) {
      return NextResponse.json({ error: "Título e mensagem são obrigatórios" }, { status: 400 });
    }

    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    const payload: PushPayload = {
      title,
      body: bodyText,
      icon: typeof requestBody.icon === "string" ? requestBody.icon : undefined,
      tag: typeof requestBody.tag === "string" ? requestBody.tag.slice(0, 60) : undefined,
      url:
        typeof requestBody.url === "string" && requestBody.url.startsWith("/")
          ? requestBody.url
          : "/",
      requireInteraction: requestBody.requireInteraction === true,
    };

    let sent = 0;
    let expired = 0;
    for (const subscription of subscriptions) {
      const result = await sendPush(
        {
          endpoint: subscription.endpoint,
          auth: subscription.auth,
          p256dh: subscription.p256dh,
        },
        payload,
      );

      if (result.success) {
        sent++;
        await db
          .update(pushSubscriptions)
          .set({ lastSentAt: new Date() })
          .where(eq(pushSubscriptions.id, subscription.id));
      } else if (result.statusCode === 410 || result.statusCode === 404) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, subscription.id));
        expired++;
      }
    }

    await db.insert(notificationLogs).values({
      userId,
      type: String(requestBody.type ?? "generico").slice(0, 50),
      title,
      body: bodyText,
    });

    return NextResponse.json({ ok: true, sent, expired });
  } catch (error) {
    console.error("Send notification error:", error);
    return NextResponse.json({ error: "Falha ao enviar" }, { status: 500 });
  }
}
