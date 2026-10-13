import { NextRequest, NextResponse } from "next/server";
import { generateAndSendDailyReport } from "@/utils/telegram";

export const dynamic = "force-dynamic";

/**
 * Endpoint для автоматической отправки отчета по крону Vercel в 23:30 (18:30 UTC)
 * Или для ручного вызова авторизованным сервисом
 */
export async function GET() {
  return NextResponse.json({ success: true, message: "Daily report cron is disabled" });
}

export async function POST() {
  return NextResponse.json({ success: true, message: "Daily report cron is disabled" });
}
