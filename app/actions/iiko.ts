"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { 
  getIikoOrganizations, 
  getIikoEmployees, 
  getIikoAttendanceShifts,
  createIikoRestoAttendance,
  getIikoRestoToken,
  type IikoEmployee
} from "@/utils/iiko/client";

function normalizePhone(phone?: string | null): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "").replace(/^8/, "7");
}

export async function testIikoConnection() {
  try {
    const token = await getIikoRestoToken();
    const employees = await getIikoEmployees();
    return { 
      success: true, 
      token: `${token.slice(0, 4)}...${token.slice(-4)}`,
      employeesFound: employees.length 
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Ошибка подключения к iiko" };
  }
}

export async function getIikoStaffList() {
  try {
    const staff = await getIikoEmployees();
    return { success: true, employees: staff || [] };
  } catch (err: any) {
    return { success: false, employees: [], error: err.message || "Ошибка загрузки из iiko" };
  }
}

/**
 * Импорт / Синхронизация сотрудников из iiko в базу данных profiles
 */
export async function syncEmployeesFromIiko() {
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const iikoEmployees = await getIikoEmployees();
    if (!iikoEmployees || iikoEmployees.length === 0) {
      return { success: false, error: "В iiko не найдены сотрудники" };
    }

    const { data: dbProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, pin_code, iiko_user_id, position");

    let importedCount = 0;
    let updatedCount = 0;

    for (const emp of iikoEmployees) {
      const fullName = `${emp.lastName || ""} ${emp.firstName || ""}`.trim() || "Сотрудник iiko";
      const phone = emp.phone || "";
      const pinCode = emp.code || Math.floor(1000 + Math.random() * 9000).toString();
      const normPhone = normalizePhone(phone);
      const rawRole = emp.mainRoleCode || "employee";
      const isCashier = rawRole.toLowerCase().includes("кассир") || rawRole.toLowerCase().includes("cs");
      const position = isCashier ? "Кассир" : (rawRole || "Сотрудник");

      const existing = dbProfiles?.find(p => 
        (p.iiko_user_id && p.iiko_user_id === emp.id) ||
        (normPhone && normalizePhone(p.phone) === normPhone) ||
        (p.full_name && p.full_name.toLowerCase().trim() === fullName.toLowerCase().trim())
      );

      if (existing) {
        await supabaseAdmin
          .from("profiles")
          .update({
            iiko_user_id: emp.id,
            phone: existing.phone || phone,
            position: existing.position || position,
          })
          .eq("id", existing.id);
        updatedCount++;
      } else {
        // Создаем auth пользователя для нового сотрудника
        const systemEmail = `pin_${pinCode}_${Date.now().toString().slice(-4)}@employee.null.control`;
        const systemPassword = `PinPass_${pinCode}_${Date.now()}`;

        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: systemEmail,
          password: systemPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            pin_code: pinCode,
          }
        });

        if (authData?.user) {
          await supabaseAdmin
            .from("profiles")
            .upsert({
              id: authData.user.id,
              full_name: fullName,
              position,
              phone,
              pin_code: pinCode,
              role: "employee",
              is_active: true,
              iiko_user_id: emp.id,
            });
          importedCount++;
        }
      }
    }

    return {
      success: true,
      data: {
        totalIikoEmployees: iikoEmployees.length,
        importedCount,
        updatedCount,
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Отправка конкретной смены сотрудника в iiko
 */
export async function sendShiftToIiko({
  employeeId,
  checkInTime,
  checkOutTime,
}: {
  employeeId: string;
  checkInTime: string | Date;
  checkOutTime: string | Date;
}): Promise<{ success: boolean; iikoAttendanceId?: string; error?: string }> {
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, pin_code, iiko_user_id")
      .eq("id", employeeId)
      .single();

    if (profErr || !profile) {
      return { success: false, error: "Профиль сотрудника не найден" };
    }

    let iikoUserId = profile.iiko_user_id;

    if (!iikoUserId) {
      try {
        const iikoEmployees = await getIikoEmployees();
        const normPhone = normalizePhone(profile.phone);
        const cleanName = profile.full_name?.toLowerCase().trim();

        const match = iikoEmployees.find((e) => {
          if (normPhone && normalizePhone(e.phone) === normPhone) return true;
          if (profile.pin_code && e.code === profile.pin_code) return true;
          const iikoName = `${e.lastName || ""} ${e.firstName || ""}`.toLowerCase().trim();
          return cleanName && (iikoName.includes(cleanName) || cleanName.includes(iikoName) || cleanName.includes(e.firstName?.toLowerCase()));
        });

        if (match) {
          iikoUserId = match.id;
          await supabaseAdmin
            .from("profiles")
            .update({ iiko_user_id: match.id })
            .eq("id", profile.id);
        }
      } catch (err: any) {
        console.warn("Could not auto-match iiko employee:", err.message);
      }
    }

    if (!iikoUserId) {
      return { 
        success: false, 
        error: `Сотрудник "${profile.full_name}" не сопоставлен с пользователем в iiko` 
      };
    }

    const res = await createIikoRestoAttendance({
      employeeIikoId: iikoUserId,
      dateFrom: checkInTime,
      dateTo: checkOutTime,
      comment: "Отметка из приложения контроля смен Sushi Control",
    });

    if (!res.success) {
      return { success: false, error: res.error };
    }

    return { success: true, iikoAttendanceId: res.id };
  } catch (err: any) {
    console.error("sendShiftToIiko exception:", err);
    return { success: false, error: err.message || "Ошибка отправки в iiko" };
  }
}

/**
 * Синхронизация завершенных смен из приложения в iiko
 */
export async function syncCompletedShiftsToIiko(targetDate?: string) {
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date();
    const dateStr = targetDate || now.toISOString().split("T")[0];

    const startOfDay = `${dateStr}T00:00:00.000Z`;
    const endOfDay = `${dateStr}T23:59:59.999Z`;

    const { data: records, error } = await supabaseAdmin
      .from("time_records")
      .select("id, employee_id, record_type, recorded_at, notes")
      .gte("recorded_at", startOfDay)
      .lte("recorded_at", endOfDay)
      .order("recorded_at", { ascending: true });

    if (error || !records) {
      return { success: false, error: error?.message || "Ошибка чтения записей" };
    }

    const empRecords: Record<string, typeof records> = {};
    for (const r of records) {
      if (!empRecords[r.employee_id]) empRecords[r.employee_id] = [];
      empRecords[r.employee_id].push(r);
    }

    let syncedCount = 0;
    const errors: string[] = [];

    for (const [empId, empRecs] of Object.entries(empRecords)) {
      const checkIns = empRecs.filter(r => r.record_type === "check_in");
      const checkOuts = empRecs.filter(r => r.record_type === "check_out");

      if (checkIns.length > 0 && checkOuts.length > 0) {
        const firstIn = checkIns[0];
        const lastOut = checkOuts[checkOuts.length - 1];

        if (lastOut.notes?.includes("iiko: synced")) {
          continue;
        }

        const syncResult = await sendShiftToIiko({
          employeeId: empId,
          checkInTime: firstIn.recorded_at,
          checkOutTime: lastOut.recorded_at,
        });

        if (syncResult.success) {
          syncedCount++;
          await supabaseAdmin
            .from("time_records")
            .update({ notes: `iiko: synced (${syncResult.iikoAttendanceId || "ok"})` })
            .eq("id", lastOut.id);
        } else {
          errors.push(syncResult.error || "Ошибка синхронизации");
        }
      }
    }

    return {
      success: true,
      data: {
        targetDate: dateStr,
        syncedShiftsCount: syncedCount,
        errors,
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Синхронизация явок из iiko в Supabase (двусторонняя)
 */
export async function triggerIikoAttendanceSync(dateStr?: string) {
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Сначала отправляем локальные смены в iiko
    await syncCompletedShiftsToIiko(dateStr);

    const orgs = await getIikoOrganizations();
    const orgIds = orgs.map((o) => o.id);
    const targetDate = dateStr || new Date().toISOString().split("T")[0];

    let iikoEmployees: IikoEmployee[] = [];
    try {
      iikoEmployees = await getIikoEmployees(orgIds);
    } catch (err: any) {
      console.warn("Could not fetch iiko employees list:", err.message);
    }

    const { data: dbProfiles, error: profError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, pin_code, iiko_user_id, is_active");

    if (profError || !dbProfiles) {
      return { success: false, error: `Ошибка загрузки профилей: ${profError?.message}` };
    }

    for (const p of dbProfiles) {
      if (!p.iiko_user_id && iikoEmployees.length > 0) {
        const normPhone = normalizePhone(p.phone);
        const cleanName = p.full_name?.toLowerCase().trim();

        const match = iikoEmployees.find((e) => {
          if (normPhone && normalizePhone(e.phone) === normPhone) return true;
          if (p.pin_code && e.code === p.pin_code) return true;
          const iikoName = `${e.lastName || ""} ${e.firstName || ""}`.toLowerCase().trim();
          return cleanName && (iikoName.includes(cleanName) || cleanName.includes(iikoName) || cleanName.includes(e.firstName?.toLowerCase()));
        });

        if (match) {
          p.iiko_user_id = match.id;
          await supabaseAdmin.from("profiles").update({ iiko_user_id: match.id }).eq("id", p.id);
        }
      }
    }

    const { data: dbLocations } = await supabaseAdmin
      .from("locations")
      .select("id, name");

    const defaultLocationId = dbLocations?.[0]?.id || null;
    const shifts = await getIikoAttendanceShifts(orgIds, targetDate);

    let insertedRecords = 0;
    let skippedRecords = 0;
    const errors: string[] = [];

    for (const shift of shifts) {
      let matchedProfile = dbProfiles.find((p) => p.iiko_user_id && p.iiko_user_id === shift.employeeId);

      if (!matchedProfile) {
        continue;
      }

      let locationId = defaultLocationId;

      if (shift.sessionStart) {
        const checkInTime = new Date(shift.sessionStart).toISOString();
        
        const { data: existingIn } = await supabaseAdmin
          .from("time_records")
          .select("id")
          .eq("employee_id", matchedProfile.id)
          .eq("record_type", "check_in")
          .gte("recorded_at", new Date(new Date(checkInTime).getTime() - 15 * 60 * 1000).toISOString())
          .lte("recorded_at", new Date(new Date(checkInTime).getTime() + 15 * 60 * 1000).toISOString())
          .limit(1);

        if (!existingIn || existingIn.length === 0) {
          const { error: insErr } = await supabaseAdmin.from("time_records").insert({
            employee_id: matchedProfile.id,
            location_id: locationId,
            record_type: "check_in",
            recorded_at: checkInTime,
            notes: `iiko sync: ${shift.id || "shift"}`
          });
          if (!insErr) insertedRecords++;
        } else {
          skippedRecords++;
        }
      }

      if (shift.sessionEnd) {
        const checkOutTime = new Date(shift.sessionEnd).toISOString();

        const { data: existingOut } = await supabaseAdmin
          .from("time_records")
          .select("id")
          .eq("employee_id", matchedProfile.id)
          .eq("record_type", "check_out")
          .gte("recorded_at", new Date(new Date(checkOutTime).getTime() - 15 * 60 * 1000).toISOString())
          .lte("recorded_at", new Date(new Date(checkOutTime).getTime() + 15 * 60 * 1000).toISOString())
          .limit(1);

        if (!existingOut || existingOut.length === 0) {
          const { error: insErr } = await supabaseAdmin.from("time_records").insert({
            employee_id: matchedProfile.id,
            location_id: locationId,
            record_type: "check_out",
            recorded_at: checkOutTime,
            notes: `iiko sync: ${shift.id || "shift"}`
          });
          if (!insErr) insertedRecords++;
        } else {
          skippedRecords++;
        }
      }
    }

    return {
      success: true,
      data: {
        targetDate,
        totalShiftsFound: shifts.length,
        insertedRecords,
        skippedRecords,
        errors,
      },
    };
  } catch (err: any) {
    console.error("iiko sync error:", err);
    return {
      success: false,
      error: `Ошибка синхронизации с iiko: ${err.message || "Неизвестная ошибка"}`,
    };
  }
}

export async function getWaiterServiceReportAction({
  dateFrom,
  dateTo,
}: {
  dateFrom: string;
  dateTo: string;
}) {
  try {
    const { getIikoWaiterServiceTips } = await import("@/utils/iiko/client");
    const data = await getIikoWaiterServiceTips({ dateFrom, dateTo });
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message, data: { daily: [], totalsByWaiter: {} } };
  }
}

export async function getEmployeeWaiterTipsForMonth({
  employeeName,
  dateFrom,
  dateTo,
}: {
  employeeName: string;
  dateFrom: string;
  dateTo: string;
}) {
  try {
    const { getIikoWaiterServiceTips } = await import("@/utils/iiko/client");
    const { daily, totalsByWaiter } = await getIikoWaiterServiceTips({ dateFrom, dateTo });

    const cleanEmpName = employeeName.toLowerCase().trim();

    let matchedTotals = { increaseSum: 0, waiterBonus: 0, dishSum: 0 };
    const matchedDaily: Array<{ date: string; bonus: number; increaseSum: number; dishSum: number }> = [];

    for (const [wName, totals] of Object.entries(totalsByWaiter)) {
      const cleanW = wName.toLowerCase().trim();
      if (cleanW === cleanEmpName || cleanW.includes(cleanEmpName) || cleanEmpName.includes(cleanW)) {
        matchedTotals.increaseSum += totals.increaseSum;
        matchedTotals.waiterBonus += totals.waiterBonus;
        matchedTotals.dishSum += totals.dishSum;
      }
    }

    for (const d of daily) {
      const cleanW = d.waiterName.toLowerCase().trim();
      if (cleanW === cleanEmpName || cleanW.includes(cleanEmpName) || cleanEmpName.includes(cleanW)) {
        matchedDaily.push({
          date: d.date,
          bonus: d.waiterBonus,
          increaseSum: d.increaseSum,
          dishSum: d.dishSum,
        });
      }
    }

    return {
      success: true,
      totalBonus: matchedTotals.waiterBonus,
      totalIncreaseSum: matchedTotals.increaseSum,
      totalRevenue: matchedTotals.dishSum,
      dailyBreakdown: matchedDaily,
    };
  } catch (err: any) {
    return {
      success: false,
      totalBonus: 0,
      totalIncreaseSum: 0,
      totalRevenue: 0,
      dailyBreakdown: [],
      error: err.message,
    };
  }
}
