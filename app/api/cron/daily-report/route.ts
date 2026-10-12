import { NextRequest, NextResponse } from "next/server";
import { generateAndSendDailyReport } from "@/utils/telegram";

export const dynamic = "force-dynamic";

/**
 * Endpoint для автоматической отправки отчета по крону Vercel в 23:30 (18:30 UTC)
 * Или для ручного вызова авторизованным сервисом
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get("date") || undefined;

    const result = await generateAndSendDailyReport(targetDate);

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    console.error("Daily report cron error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let targetDate: string | undefined;
    try {
      const body = await request.json();
      targetDate = body?.date;
    } catch {
      // No JSON body
    }

    const result = await generateAndSendDailyReport(targetDate);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: any) {
    console.error("Daily report cron POST error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
