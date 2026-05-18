"use server";

import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function processQRScan(locationId: string, clientTimeIso?: string) {
  try {
    const supabase = createClient();
    
    // Используем переданное время или серверное как запасной вариант
    const now = clientTimeIso ? new Date(clientTimeIso) : new Date();
    
    // Проверка авторизации
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Необходима авторизация" };
    }

    // Проверка формата UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(locationId)) {
      return { success: false, error: "Неверный формат QR-кода" };
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Проверка локации
    const { data: location, error: locError } = await supabaseAdmin
      .from("locations")
      .select("id, name, is_active")
      .eq("id", locationId)
      .single();

    if (locError || !location) {
      return { success: false, error: "Локация не найдена" };
    }
    
    if (!location.is_active) {
      return { success: false, error: "Локация неактивна" };
    }

    // 2. Получение последней отметки сотрудника за последние 24 часа 
    // (вместо жесткого "сегодня", чтобы избежать проблем с границей суток)
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: lastRecords, error: recordsError } = await supabaseAdmin
      .from("time_records")
      .select("id, record_type, recorded_at")
      .eq("employee_id", user.id)
      .gte("recorded_at", dayAgo.toISOString())
      .order("recorded_at", { ascending: false })
      .limit(1);

    const lastRecord = lastRecords && lastRecords.length > 0 ? lastRecords[0] : null;

    // 3. Проверка кулдауна (2 минуты)
    if (lastRecord) {
      const lastTime = new Date(lastRecord.recorded_at).getTime();
      const diffMinutes = (now.getTime() - lastTime) / (1000 * 60);

      if (diffMinutes < 2) {
        return { 
          success: false, 
          error: `Слишком частые отметки. Подождите еще ${Math.ceil(2 - diffMinutes)} мин.` 
        };
      }
    }

    // Получаем профиль для проверок
    const { data: employeeProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, can_upload_production")
      .eq("id", user.id)
      .single();

    // 4. Определение типа (если последняя была приход - делаем уход, иначе приход)
    let newRecordType = "check_in";
    if (lastRecord && lastRecord.record_type === "check_in") {
      newRecordType = "check_out";

      // Проверка выработки перед уходом удалена
    }

    // 5. Запись в базу с использованием клиентского времени
    const { error: insertError } = await supabaseAdmin
      .from("time_records")
      .insert({
        employee_id: user.id,
        location_id: location.id,
        record_type: newRecordType,
        recorded_at: now.toISOString()
      });

    if (insertError) {
      return { success: false, error: `Ошибка записи: ${insertError.message}` };
    }

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/", "layout");

    return { 
      success: true, 
      data: {
        type: newRecordType,
        locationName: location.name,
        time: now.toISOString(),
        message: newRecordType === "check_in" ? "Хорошей смены!" : "Хорошей дороги домой!"
      }
    };

  } catch (error: any) {
    console.error("Process QR Scan Exception:", error);
    return { success: false, error: `Системная ошибка: ${error.message || "Неизвестная ошибка"}` };
  }
}

export async function deleteRecord(id: string) {
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Проверка прав (должен быть админ)
    const { createClient: createSessionClient } = await import("@/utils/supabase/server");
    const sessionClient = createSessionClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return { error: "Необходима авторизация" };
    
    const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return { error: "Нет прав для удаления" };

    const { error } = await supabaseAdmin.from("time_records").delete().eq("id", id);
    if (error) return { error: error.message };
    
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function createManualRecord(formData: FormData) {
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Проверка прав (должен быть админ)
    const { createClient: createSessionClient } = await import("@/utils/supabase/server");
    const sessionClient = createSessionClient();
    const { data: { user }, error: userError } = await sessionClient.auth.getUser();
    if (!user) return { error: "Необходима авторизация: " + (userError?.message || "нет пользователя") };
    
    const { data: profile, error: profileError } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
    if (profileError) return { error: "Ошибка получения профиля: " + profileError.message };
    if (profile?.role !== "admin") return { error: "Нет прав. Ваша текущая роль: " + (profile?.role || "не найдена") };

    const employeeId = formData.get("employeeId") as string;
    const recordType = formData.get("recordType") as string;
    const datetime = formData.get("datetime") as string;

    // input type="datetime-local" отправляет время без часового пояса (например "2024-05-18T10:00").
    // Так как Vercel работает в UTC, он подумает, что это UTC. Принудительно добавляем зону Алматы (+05:00).
    let almatyDatetime = datetime;
    if (almatyDatetime && almatyDatetime.length === 16) {
      almatyDatetime += ":00+05:00";
    }

    // Ищем дефолтную локацию или любую первую
    const { data: location } = await supabaseAdmin.from("locations").select("id").limit(1).single();

    const { error } = await supabaseAdmin.from("time_records").insert({
      employee_id: employeeId,
      record_type: recordType,
      recorded_at: new Date(almatyDatetime).toISOString(),
      location_id: location?.id || null, // Если нет локаций
      notes: "Добавлено вручную"
    });

    if (error) return { error: error.message };
    
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
