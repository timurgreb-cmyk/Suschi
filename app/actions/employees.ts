"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// Для админских действий (создание пользователя в auth) 
// нам нужен Supabase Client с service_role_key
export async function createEmployee(formData: FormData) {
  // Получаем Service Role Key из env
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const pinCode = formData.get("pinCode") as string;
  const fullName = formData.get("fullName") as string;
  let position = (formData.get("position") as string) || "";
  const phone = formData.get("phone") as string;
  const shiftRate = parseFloat(formData.get("shiftRate") as string) || 0;
  const isOvertimeEnabled = formData.get("isOvertimeEnabled") === "true";
  const isCashier = formData.get("isCashier") === "true";

  if (isCashier) {
    if (!position.trim()) {
      position = "Кассир";
    } else if (!position.toLowerCase().includes("кассир")) {
      position = `${position.trim()} (Кассир)`;
    }
  }

  // Генерируем системный email и пароль для PIN-кода
  const systemEmail = `pin_${pinCode}@employee.null.control`;
  const systemPassword = `${pinCode}_nullcontrol_secret`;

  try {
    // Проверяем, не занят ли PIN-код (так как он UNIQUE)
    const { data: existingPin } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("pin_code", pinCode)
      .single();
      
    if (existingPin) {
      return { error: "Этот PIN-код уже используется другим сотрудником. Придумайте другой." };
    }

    // 1. Создаем пользователя в auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: systemEmail,
      password: systemPassword,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return { error: authError?.message || "Ошибка создания системного аккаунта" };
    }

    // 2. Создаем профиль в public.profiles
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authData.user.id,
        full_name: fullName,
        position: position,
        phone: phone,
        shift_rate: shiftRate,
        role: "employee",
        is_active: true,
        pin_code: pinCode,
        is_overtime_enabled: isOvertimeEnabled
      });

    if (profileError) {
      // Если профиль не создался, удаляем auth юзера для консистентности
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return { error: "Ошибка создания профиля: " + profileError.message };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function updateEmployee(formData: FormData) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const id = formData.get("id") as string;
  const pinCode = formData.get("pinCode") as string;
  const fullName = formData.get("fullName") as string;
  let position = (formData.get("position") as string) || "";
  const phone = formData.get("phone") as string;
  const shiftRate = parseFloat(formData.get("shiftRate") as string) || 0;
  const isOvertimeEnabled = formData.get("isOvertimeEnabled") === "true";
  const isActive = formData.get("isActive") === "true";
  const isCashier = formData.get("isCashier") === "true";

  if (isCashier) {
    if (!position.trim()) {
      position = "Кассир";
    } else if (!position.toLowerCase().includes("кассир")) {
      position = `${position.trim()} (Кассир)`;
    }
  } else {
    // If cashier was unchecked, remove "(Кассир)" or clean up "Кассир" if that was the only title
    if (position.toLowerCase() === "кассир") {
      position = "";
    } else {
      position = position.replace(/\s*\(\s*кассир\s*\)/gi, "").trim();
    }
  }

  try {
    // 1. Получаем текущие данные профиля, чтобы проверить, изменился ли PIN
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles")
      .select("pin_code")
      .eq("id", id)
      .single();

    const pinChanged = pinCode && pinCode !== currentProfile?.pin_code;

    if (pinChanged) {
      // Проверяем уникальность нового PIN
      const { data: existingPin } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("pin_code", pinCode)
        .neq("id", id)
        .single();
        
      if (existingPin) {
        return { error: "Этот PIN-код уже занят другим сотрудником." };
      }

      // Обновляем Auth данные (email и пароль)
      const newEmail = `pin_${pinCode}@employee.null.control`;
      const newPassword = `${pinCode}_nullcontrol_secret`;

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        email: newEmail,
        password: newPassword,
      });

      if (authUpdateError) {
        return { error: "Ошибка обновления системных данных: " + authUpdateError.message };
      }
    }

    // 2. Обновляем профиль
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: fullName,
        position: position,
        phone: phone,
        shift_rate: shiftRate,
        is_active: isActive,
        pin_code: pinCode,
        is_overtime_enabled: isOvertimeEnabled
      })
      .eq("id", id);

    if (profileError) {
      return { error: "Ошибка обновления профиля: " + profileError.message };
    }

    // Если меняли email/пароль, это нужно делать через auth.admin.updateUserById, 
    // но для простоты обновляем только данные профиля.

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
