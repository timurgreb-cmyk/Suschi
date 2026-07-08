"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export async function processOvertimeApproval(
  employeeId: string, 
  recordDate: string, 
  calculatedHours: number, 
  approvedHours: number, 
  status: 'approved' | 'rejected'
) {
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
    if (profile?.role !== "admin") return { error: "Нет прав" };

    // Сохраняем решение в базу (upsert)
    const { error } = await supabaseAdmin.from("overtime_approvals").upsert(
      {
        employee_id: employeeId,
        record_date: recordDate,
        calculated_hours: calculatedHours,
        approved_hours: approvedHours,
        status: status
      },
      { onConflict: 'employee_id, record_date' }
    );

    if (error) return { error: error.message };
    
    revalidatePath("/admin/timesheet");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function processLateFineApproval(
  employeeId: string, 
  recordDate: string, 
  calculatedFine: number, 
  approvedFine: number, 
  status: 'approved' | 'rejected' | 'pending'
) {
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
    if (profile?.role !== "admin") return { error: "Нет прав" };

    // Сохраняем решение в базу (upsert)
    const { error } = await supabaseAdmin.from("late_fine_approvals").upsert(
      {
        employee_id: employeeId,
        record_date: recordDate,
        calculated_fine: calculatedFine,
        approved_fine: approvedFine,
        status: status
      },
      { onConflict: 'employee_id, record_date' }
    );

    if (error) return { error: error.message };
    
    revalidatePath("/admin/timesheet");
    revalidatePath("/admin/fines");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function resetMonthLateFines(monthStr: string) {
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
    if (profile?.role !== "admin") return { error: "Нет прав" };

    const [year, month] = monthStr.split("_");
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const { error } = await supabaseAdmin
      .from("late_fine_approvals")
      .delete()
      .gte("record_date", startDate)
      .lte("record_date", endDate);

    if (error) return { error: error.message };
    
    revalidatePath("/admin/timesheet");
    revalidatePath("/admin/fines");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function resetMonthOvertimes(monthStr: string) {
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
    if (profile?.role !== "admin") return { error: "Нет прав" };

    const [year, month] = monthStr.split("_");
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const { error } = await supabaseAdmin
      .from("overtime_approvals")
      .delete()
      .gte("record_date", startDate)
      .lte("record_date", endDate);

    if (error) return { error: error.message };
    
    revalidatePath("/admin/timesheet");
    revalidatePath("/admin/fines");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

