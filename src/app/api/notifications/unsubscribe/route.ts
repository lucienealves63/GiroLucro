import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/unsubscribe — desliga as notificações.
 *
 * Body: { endpoint?: string, all?: boolean }
 *  - endpoint: remove só este dispositivo/navegador;
 *  - all: remove todas as inscrições do usuário (útil quando o navegador já
 *    apagou a inscrição local e o servidor ainda guarda o endpoint).
 *
 * Sempre escopado ao usuário da sessão: ninguém remove inscrição de outra
 * pessoa informando um endpoint alheio.
 */
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const endpoint = typeof body.endpoint === "string" ? body.endpoint.slice(0, 800) : "";
    const all = body.all === true;

    if (!endpoint && !all) {
      return NextResponse.json(
        { error: "Informe o dispositivo (endpoint) ou peça a remoção de todos." },
        { status: 400 },
      );
    }

    const removed = await db
      .delete(pushSubscriptions)
      .where(
        endpoint && !all
          ? and(
              eq(pushSubscriptions.userId, user.id),
              eq(pushSubscriptions.endpoint, endpoint),
            )
          : eq(pushSubscriptions.userId, user.id),
      )
      .returning({ id: pushSubscriptions.id });

    return NextResponse.json({ ok: true, removed: removed.length });
  } catch (error) {
    console.error("[notifications] falha ao desativar:", error);
    return NextResponse.json(
      { error: "Não foi possível desativar as notificações agora." },
      { status: 500 },
    );
  }
}
