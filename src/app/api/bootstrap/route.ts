import { NextResponse } from "next/server";
import { startNotificationCron } from "@/lib/notification-cron";

export const dynamic = "force-dynamic";

// Rota interna para bootstrap do cron (chamada pelo deploy/startup)
// Em produção, use uma health check que chama isso periodicamente
let cronStarted = false;

export async function GET() {
  if (!cronStarted && (process.env.NODE_ENV === "production" || process.env.RUN_CRON_LOCAL)) {
    cronStarted = true;
    startNotificationCron();
  }
  return NextResponse.json({ ok: true });
}
