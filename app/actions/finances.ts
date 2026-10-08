"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * 1. Запрос аванса сотрудником
 */
export async function requestAdvance(data: {
  employeeId: string;
  amount: number;
  reason?: string;
}) {
  const supabase = getSupabaseAdmin();
  const { employeeId, amount, reason } = data;

  if (!employeeId || !amount || amount <= 0) {
    return { success: false, error: "Укажите корректную сумму аванса" };
  }

  try {
    const { data: inserted, error } = await supabase
      .from("advances")
      .insert({
        employee_id: employeeId,
        amount: Math.abs(amount),
        reason: reason?.trim() || "На личные нужды",
        status: "pending",
        date: new Date().toISOString().split("T")[0],
      })
      .select("*, employee:profiles!employee_id(full_name, position)")
      .single();

    if (error) return { success: false, error: error.message };

    revalidatePath("/", "layout");
    return { success: true, advance: inserted };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 2. Обновление статуса аванса
 */
export async function updateAdvanceStatus(id: string, status: "approved" | "rejected" | "paid", approvedBy?: string) {
  const supabase = getSupabaseAdmin();
  try {
    const { error } = await supabase
      .from("advances")
      .update({
        status,
        approved_by: approvedBy || null,
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 3. Внесение удержания по зарплате (Инвентаризация, недостачи, списания)
 */
export async function createDeduction(data: {
  employeeId: string;
  amount: number;
  category: string;
  comment?: string;
  date?: string;
  createdBy?: string;
}) {
  const supabase = getSupabaseAdmin();
  const { employeeId, amount, category, comment, date, createdBy } = data;

  if (!employeeId || !amount || amount <= 0) {
    return { success: false, error: "Укажите сотрудника и сумму удержания" };
  }

  try {
    const { error } = await supabase.from("deductions").insert({
      employee_id: employeeId,
      amount: Math.abs(amount),
      category: category || "Инвентаризация",
      comment: comment?.trim() || null,
      date: date || new Date().toISOString().split("T")[0],
      created_by: createdBy || null,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 4. Удаление удержания
 */
export async function deleteDeduction(id: string) {
  const supabase = getSupabaseAdmin();
  try {
    const { error } = await supabase.from("deductions").delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 5. Получение финансовой сводки по сотруднику
 */
export async function getEmployeeFinances(employeeId: string, monthStr?: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const yearMonth = monthStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startDate = `${yearMonth}-01`;
  const endDate = `${yearMonth}-31`;

  try {
    const { data: advances } = await supabase
      .from("advances")
      .select("*")
      .eq("employee_id", employeeId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    const { data: deductions } = await supabase
      .from("deductions")
      .select("*")
      .eq("employee_id", employeeId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });

    return {
      success: true,
      advances: advances || [],
      deductions: deductions || [],
    };
  } catch (err: any) {
    return { success: false, error: err.message, advances: [], deductions: [] };
  }
}

/**
 * 6. Ручная синхронизация зарплат/ФОТ за выбранную дату в clear.cut
 */
export async function syncPayrollToClearcutAction(targetDate?: string) {
  try {
    const { generateAndSendDailyReport } = await import("@/utils/telegram");
    const res = await generateAndSendDailyReport(targetDate);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

