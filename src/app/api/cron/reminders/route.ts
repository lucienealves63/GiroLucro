import { NextResponse } from "next/server";
import { runRefundWindowReminders } from "@/lib/purchase";

export const dynamic = "force-dynamic";

/**
 * Lembretes de pós-venda por e-mail (ver src/lib/purchase.ts):
 * avisa quem comprou que o prazo de arrependimento está terminando.
 *
 * Rodar por cron externo (1x por dia é suficiente):
 *   curl "https://SEU-DOMINIO/api/cron/reminders?token=SEU_TOKEN"
 *
 * Para conferir sem enviar nada:
 *   curl "https://SEU-DOMINIO/api/cron/reminders?token=SEU_TOKEN&dry=1"
 *
 * O token é `CRON_SECRET` (recomendado) ou, na falta dele, `ADMIN_SETUP_TOKEN`.
 * Sem token configurado em produção, a rota recusa a execução.
 */
function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET || process.env.ADMIN_SETUP_TOKEN || "";
  if (!expected) return process.env.NODE_ENV !== "production";
  const url = new URL(req.url);
  const token =
    url.searchParams.get("token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return token === expected;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    const report = await runRefundWindowReminders({ dryRun: dry });
    return NextResponse.json({ ok: true, dryRun: dry, ...report });
  } catch (error) {
    console.error("[reminders] falha ao enviar lembretes:", error);
    return NextResponse.json(
      { error: "Falha ao enviar os lembretes de pós-venda." },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
