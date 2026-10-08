"use server";

import { createClient } from "@/utils/supabase/server";
import { generateAndSendDailyReport, sendTelegramMessage } from "@/utils/telegram";

export async function sendDailyTelegramReportAction(targetDate?: string) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Необходима авторизация" };
    }

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { success: false, error: "Недостаточно прав (только администратор)" };
    }

    const res = await generateAndSendDailyReport(targetDate);
    return res;
  } catch (error: any) {
    console.error("sendDailyTelegramReportAction error:", error);
    return { success: false, error: error.message || "Ошибка отправки отчета" };
  }
}

export async function testTelegramBotAction() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Необходима авторизация" };

    const message = `🤖 <b>Тестовое сообщение от Suschi Control</b>\n\n✅ Интеграция с Telegram-ботом работает корректно!\n⏰ Время: ${new Date().toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}`;
    const res = await sendTelegramMessage(message);
    return res;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
