import { NextRequest, NextResponse } from "next/server";
import { generateAndSendDailyReport } from "@/utils/telegram";

export const dynamic = "force-dynamic";

/**
 * Endpoint для автоматической отправки отчета по крону Vercel в 23:30 (18:30 UTC)
 * Или для ручного вызова авторизованным сервисом
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Если настроен CRON_SECRET, проверяем Bearer токен
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Разрешаем также вызовы от Vercel Cron
      const isVercelCron = request.headers.get("user-agent")?.includes("vercel-cron");
      if (!isVercelCron) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

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
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const isVercelCron = request.headers.get("user-agent")?.includes("vercel-cron");
      if (!isVercelCron) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

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
