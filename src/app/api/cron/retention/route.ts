import { NextResponse } from "next/server";
import { runRetentionCleanup } from "@/lib/retention";

export const dynamic = "force-dynamic";

/**
 * Limpeza de retenção de dados (ver src/lib/retention.ts).
 *
 * Rodar manualmente ou por cron externo:
 *   curl "https://SEU-DOMINIO/api/cron/retention?token=SEU_TOKEN"
 *
 * O token é `CRON_SECRET` (recomendado) ou, na falta dele, `ADMIN_SETUP_TOKEN`.
 * Sem token configurado em produção, a rota recusa a execução.
 */
function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET || process.env.ADMIN_SETUP_TOKEN || "";
  if (!expected) return process.env.NODE_ENV !== "production";
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return token === expected;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const report = await runRetentionCleanup();
    return NextResponse.json({ ok: true, ...report });
  } catch (error) {
    console.error("[retention] falha na limpeza:", error);
    return NextResponse.json(
      { error: "Falha ao executar a limpeza de retenção." },
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
