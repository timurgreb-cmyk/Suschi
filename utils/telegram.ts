import { createClient as createAdminClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

/**
 * Отправляет сообщение в Telegram во все настроенные чаты (поддерживает один или несколько через запятую)
 */
export async function sendTelegramMessage(text: string): Promise<{ success: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIdsStr = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatIdsStr) {
    console.warn("Telegram bot token or chat ID is missing in environment variables.");
    return { success: false, error: "TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не настроены в .env" };
  }

  const chatIds = chatIdsStr
    .split(",")
    .map(id => id.trim())
    .filter(Boolean);

  if (chatIds.length === 0) {
    return { success: false, error: "Нет валидных TELEGRAM_CHAT_ID" };
  }

  const errors: string[] = [];

  for (const chatId of chatIds) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        console.error(`Telegram error for chat ${chatId}:`, data);
        errors.push(`Чат ${chatId}: ${data.description || "Ошибка отправки"}`);
      }
    } catch (err: any) {
      console.error(`Telegram fetch error for chat ${chatId}:`, err);
      errors.push(`Чат ${chatId}: ${err.message || "Ошибка сети"}`);
    }
  }

  if (errors.length > 0 && errors.length === chatIds.length) {
    return { success: false, error: errors.join("; ") };
  }

  return { success: true };
}

/**
 * Отправляет мгновенное уведомление о приходе или уходе сотрудника
 */
export async function sendCheckInOutTelegramNotification(params: {
  type: "check_in" | "check_out";
  employeeName: string;
  position?: string | null;
  locationName: string;
  timeIso: string;
  isLate?: boolean;
  lateMinutes?: number;
  calculatedFine?: number;
  planStart?: string;
  isCashier?: boolean;
  workedDurationStr?: string;
  shiftRate?: number;
}) {
  try {
    const {
      type,
      employeeName,
      position,
      locationName,
      timeIso,
      isLate,
      lateMinutes,
      calculatedFine,
      planStart,
      isCashier,
      workedDurationStr,
      shiftRate,
    } = params;

    // Время в поясе Алматы (UTC+5)
    const date = new Date(timeIso);
    const localDate = new Date(date.getTime() + 5 * 60 * 60 * 1000);
    const timeStr = `${String(localDate.getUTCHours()).padStart(2, "0")}:${String(localDate.getUTCMinutes()).padStart(2, "0")}`;
    const dateStr = `${String(localDate.getUTCDate()).padStart(2, "0")}.${String(localDate.getUTCMonth() + 1).padStart(2, "0")}.${localDate.getUTCFullYear()}`;

    const posBadge = position ? `(${position})` : "";

    let message = "";

    if (type === "check_in") {
      message += `🟢 <b>ПРИХОД НА СМЕНУ</b>\n\n`;
      message += `👤 <b>Сотрудник:</b> ${employeeName} ${posBadge}\n`;
      message += `📍 <b>Точка:</b> ${locationName}\n`;
      message += `⏰ <b>Время отметки:</b> ${timeStr} (${dateStr})\n`;
      if (planStart) {
        message += `📋 <b>График:</b> с ${planStart}${isCashier ? " (Кассир)" : ""}\n`;
      }

      if (isLate && lateMinutes && lateMinutes > 0) {
        if (calculatedFine && calculatedFine > 0) {
          message += `\n🔴 <b>ОПОЗДАНИЕ НА ${lateMinutes} МИН.!</b>\n`;
          message += `⚠️ <b>Штраф за опоздание: <code>-${calculatedFine.toLocaleString("ru-RU")} ₸</code></b>\n`;
        } else {
          message += `\n🟡 <b>Опоздание на ${lateMinutes} мин.</b> (льготный интервал до 10 мин без штрафа)\n`;
        }
      } else {
        message += `✨ <b>Статус:</b> 🟢 Вовремя\n`;
      }
    } else {
      message += `🔴 <b>УХОД СО СМЕНЫ</b>\n\n`;
      message += `👤 <b>Сотрудник:</b> ${employeeName} ${posBadge}\n`;
      message += `📍 <b>Точка:</b> ${locationName}\n`;
      message += `⏰ <b>Время ухода:</b> ${timeStr} (${dateStr})\n`;

      if (workedDurationStr) {
        message += `⏱ <b>Отработано:</b> ${workedDurationStr}\n`;
      }

      if (shiftRate !== undefined && shiftRate !== null && shiftRate > 0) {
        message += `💰 <b>Ставка за смену:</b> ${shiftRate.toLocaleString("ru-RU")} ₸\n`;
      }
    }

    return await sendTelegramMessage(message);
  } catch (err: any) {
    console.error("sendCheckInOutTelegramNotification error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Формирует и отправляет ежедневный отчет по окладам, сменам и штрафам в 23:30 (или по требованию)
 */
export async function generateAndSendDailyReport(targetDateStr?: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  shiftsCount?: number;
  totalPayout?: number;
}> {
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Определяем дату в поясе Алматы (UTC+5)
    let dateStr = targetDateStr;
    if (!dateStr) {
      const now = new Date();
      const localNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);
      const yyyy = localNow.getUTCFullYear();
      const mm = String(localNow.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(localNow.getUTCDate()).padStart(2, "0");
      dateStr = `${yyyy}-${mm}-${dd}`;
    }

    const [year, month, day] = dateStr.split("-").map(Number);
    const dayDate = new Date(year, month - 1, day);
    const formattedDateHuman = format(dayDate, "d MMMM yyyy (EEEE)", { locale: ru });

    // Границы суток в UTC для дня dateStr в UTC+5
    const startOfDayUtc = new Date(Date.UTC(year, month - 1, day - 1, 19, 0, 0));
    const endOfDayUtc = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

    // 1. Получаем сотрудников
    const { data: employees } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, position, shift_rate, is_overtime_enabled")
      .eq("role", "employee")
      .order("full_name");

    // 2. Получаем локации
    const { data: locations } = await supabaseAdmin
      .from("locations")
      .select("id, name, base_hours, work_start_time, late_fine_amount");

    const locMap: Record<string, any> = {};
    locations?.forEach(l => {
      locMap[l.id] = l;
    });

    // 3. Получаем отметки за окно дат
    const { data: records } = await supabaseAdmin
      .from("time_records")
      .select("*")
      .gte("recorded_at", startOfDayUtc.toISOString())
      .lte("recorded_at", endOfDayUtc.toISOString())
      .order("recorded_at", { ascending: true });

    // 4. Получаем штрафы за опоздания за эту дату
    const { data: fineApprovals } = await supabaseAdmin
      .from("late_fine_approvals")
      .select("*")
      .eq("record_date", dateStr);

    // 5. Получаем переработки за эту дату
    const { data: overtimeApprovals } = await supabaseAdmin
      .from("overtime_approvals")
      .select("*")
      .eq("record_date", dateStr);

    // 6. Получаем удержания (deductions) за эту дату (инвентаризация, брак, недостачи)
    const { data: deductions } = await supabaseAdmin
      .from("deductions")
      .select("*, profiles:employee_id(full_name)")
      .eq("date", dateStr);

    const timeToMinutes = (timeStr: string): number => {
      const [h, m] = timeStr.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const getLocalDateStr = (iso: string) => {
      const d = new Date(iso);
      const local = new Date(d.getTime() + 5 * 60 * 60 * 1000);
      return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
    };

    const getLocalTimeStr = (iso: string) => {
      const d = new Date(iso);
      const local = new Date(d.getTime() + 5 * 60 * 60 * 1000);
      return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
    };

    interface EmployeeShiftSummary {
      employeeId: string;
      employeeName: string;
      position: string;
      firstInTime: string | null;
      lastOutTime: string | null;
      workedHoursFormatted: string;
      isStillWorking: boolean;
      noCheckout: boolean;
      shiftRate: number;
      overtimeHours: number;
      overtimePay: number;
      lateMinutes: number;
      fineAmount: number;
      fineStatus: string;
      deductionAmount: number;
      finalPay: number;
      locationName: string;
    }

    const employeeSummaries: EmployeeShiftSummary[] = [];

    employees?.forEach(emp => {
      const empRecords = records?.filter(r => r.employee_id === emp.id) || [];
      if (empRecords.length === 0) return;

      // Связываем смены
      let currentCheckIn: any = null;
      let targetShift: { firstIn: any | null; lastOut: any | null } | null = null;

      for (let i = 0; i < empRecords.length; i++) {
        const r = empRecords[i];
        if (r.record_type === "check_in") {
          const shiftDate = getLocalDateStr(r.recorded_at);
          if (shiftDate === dateStr) {
            currentCheckIn = r;
          }
        } else if (r.record_type === "check_out") {
          if (currentCheckIn) {
            targetShift = { firstIn: currentCheckIn, lastOut: r };
            currentCheckIn = null;
            break;
          }
        }
      }

      if (currentCheckIn && !targetShift) {
        targetShift = { firstIn: currentCheckIn, lastOut: null };
      }

      if (!targetShift && empRecords.length > 0) {
        const todayRecords = empRecords.filter(r => getLocalDateStr(r.recorded_at) === dateStr);
        if (todayRecords.length > 0) {
          const first = todayRecords[0];
          targetShift = {
            firstIn: first.record_type === "check_in" ? first : null,
            lastOut: first.record_type === "check_out" ? first : null,
          };
        }
      }

      if (!targetShift) return;

      const firstIn = targetShift.firstIn?.recorded_at || null;
      const lastOut = targetShift.lastOut?.recorded_at || null;
      const loc = targetShift.firstIn?.location_id ? locMap[targetShift.firstIn.location_id] : null;

      let workedMinutes = 0;
      let isStillWorking = false;
      let noCheckout = false;

      if (firstIn && lastOut) {
        workedMinutes = Math.max(0, Math.round((new Date(lastOut).getTime() - new Date(firstIn).getTime()) / (1000 * 60)));
      } else if (firstIn && !lastOut) {
        const diffHours = (new Date().getTime() - new Date(firstIn).getTime()) / (1000 * 60 * 60);
        if (diffHours < 16) {
          isStillWorking = true;
          workedMinutes = Math.max(0, Math.round((new Date().getTime() - new Date(firstIn).getTime()) / (1000 * 60)));
        } else {
          noCheckout = true;
        }
      } else if (!firstIn && lastOut) {
        noCheckout = true;
      }

      const hours = Math.floor(workedMinutes / 60);
      const mins = workedMinutes % 60;
      const workedHoursFormatted = `${hours} ч. ${mins} мин.`;

      // Расчет штрафов за опоздание
      let calculatedFine = 0;
      let fineAmount = 0;
      let fineStatus = "нет";
      let empLateMinutes = 0;

      if (firstIn && loc) {
        const isCashier = emp.position?.toLowerCase().includes("кассир") || false;
        const planStart = isCashier ? "10:45" : (loc.work_start_time || "11:00");
        const inTimeStr = getLocalTimeStr(firstIn);
        const inMins = timeToMinutes(inTimeStr);
        const planMins = timeToMinutes(planStart);

        if (inMins > planMins) {
          empLateMinutes = inMins - planMins;
          if (empLateMinutes > 10) {
            const intervals = Math.ceil((empLateMinutes - 10) / 5);
            calculatedFine = intervals * (loc.late_fine_amount || 0);
          }
        }
      }

      if (calculatedFine > 0) {
        const approved = fineApprovals?.find(a => a.employee_id === emp.id);
        if (approved) {
          fineAmount = approved.status === "approved" ? Number(approved.approved_fine) : 0;
          fineStatus = approved.status === "approved" ? "подтвержден" : approved.status === "rejected" ? "отменен" : "на согласовании";
        } else {
          fineAmount = calculatedFine;
          fineStatus = "авто";
        }
      }

      // Удержания (deductions)
      const empDeductions = deductions?.filter(d => d.employee_id === emp.id) || [];
      const totalEmpDeductions = empDeductions.reduce((sum, d) => sum + Number(d.amount || 0), 0);

      // Переработки
      const baseHours = loc ? (loc.base_hours || 8) : 8;
      const actualHours = workedMinutes / 60;
      let overtimeHours = 0;

      if (emp.is_overtime_enabled !== false && actualHours > baseHours + 1) {
        overtimeHours = Math.floor(actualHours - (baseHours + 1));
      }

      const overApproval = overtimeApprovals?.find(a => a.employee_id === emp.id);
      if (overApproval) {
        overtimeHours = overApproval.status === "approved" ? Number(overApproval.approved_hours) : 0;
      }

      const shiftRate = Number(emp.shift_rate) || 0;
      const hourlyRate = shiftRate / 8;
      const overtimePay = Math.round(overtimeHours * hourlyRate);
      const finalPay = Math.max(0, Math.round(shiftRate + overtimePay - fineAmount - totalEmpDeductions));

      employeeSummaries.push({
        employeeId: emp.id,
        employeeName: emp.full_name,
        position: emp.position || "Сотрудник",
        firstInTime: firstIn ? getLocalTimeStr(firstIn) : null,
        lastOutTime: lastOut ? getLocalTimeStr(lastOut) : null,
        workedHoursFormatted,
        isStillWorking,
        noCheckout,
        shiftRate,
        overtimeHours,
        overtimePay,
        lateMinutes: empLateMinutes,
        fineAmount,
        fineStatus,
        deductionAmount: totalEmpDeductions,
        finalPay,
        locationName: loc?.name || "Suschi Control",
      });
    });

    // Формируем текст отчета в Telegram
    let reportText = `📊 <b>СУТОЧНЫЙ ОТЧЕТ ПО СМЕНАМ И ОКЛАДАМ</b>\n`;
    reportText += `📅 <b>Дата:</b> ${formattedDateHuman}\n`;
    reportText += `🏢 <b>Заведение:</b> Sushi City (Suschi Control)\n`;
    reportText += `⏰ <b>Время формирования:</b> 23:30 (Алматы)\n`;
    reportText += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (employeeSummaries.length === 0) {
      reportText += `<i>За сегодня отметок сотрудников не зафиксировано.</i>\n\n`;
    } else {
      let totalBasePay = 0;
      let totalOvertimePay = 0;
      let totalLateFines = 0;
      let totalDeductions = 0;
      let totalFot = 0;
      let count = 1;

      reportText += `👥 <b>ОТРАБОТАННЫЕ СМЕНЫ И ОКЛАДЫ:</b>\n`;

      for (const emp of employeeSummaries) {
        totalBasePay += emp.shiftRate;
        totalOvertimePay += emp.overtimePay;
        totalLateFines += emp.fineAmount;
        totalDeductions += emp.deductionAmount;
        totalFot += emp.finalPay;

        const timeRange = emp.firstInTime 
          ? `${emp.firstInTime} — ${emp.lastOutTime ? emp.lastOutTime : (emp.isStillWorking ? "на смене 🟢" : "нет ухода ⚠️")}`
          : `—`;

        reportText += `<b>${count++}. ${emp.employeeName}</b> (${emp.position})\n`;
        reportText += `   ⏱ Время: <code>${timeRange}</code> (${emp.workedHoursFormatted})\n`;
        reportText += `   💵 Ставка: ${emp.shiftRate.toLocaleString("ru-RU")} ₸`;
        
        if (emp.overtimeHours > 0) {
          reportText += ` | +${emp.overtimePay.toLocaleString("ru-RU")} ₸ (${emp.overtimeHours}ч перераб.)`;
        }
        reportText += `\n`;

        if (emp.fineAmount > 0) {
          reportText += `   🔴 Штраф (опоздание на ${emp.lateMinutes} мин): <code>-${emp.fineAmount.toLocaleString("ru-RU")} ₸</code>\n`;
        }
        if (emp.deductionAmount > 0) {
          reportText += `   🔻 Удержания (брак/инвентарь): <code>-${emp.deductionAmount.toLocaleString("ru-RU")} ₸</code>\n`;
        }

        reportText += `   ✅ <b>К выплате: ${emp.finalPay.toLocaleString("ru-RU")} ₸</b>\n\n`;
      }

      // Блок ШТРАФОВ И УДЕРЖАНИЙ ЗА ДЕНЬ
      reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
      reportText += `⚠️ <b>ШТРАФЫ И УДЕРЖАНИЯ ЗА ДЕНЬ:</b>\n`;

      const finedEmployees = employeeSummaries.filter(e => e.fineAmount > 0 || e.deductionAmount > 0);
      if (finedEmployees.length === 0) {
        reportText += `✨ <i>Опозданий и штрафов нет — все сотрудники пришли вовремя!</i>\n\n`;
      } else {
        finedEmployees.forEach(e => {
          if (e.fineAmount > 0) {
            reportText += `• <b>${e.employeeName}</b>: Опоздание на ${e.lateMinutes} мин. ➔ <b>-${e.fineAmount.toLocaleString("ru-RU")} ₸</b> (${e.fineStatus})\n`;
          }
          if (e.deductionAmount > 0) {
            reportText += `• <b>${e.employeeName}</b>: Удержание (списание/недостача) ➔ <b>-${e.deductionAmount.toLocaleString("ru-RU")} ₸</b>\n`;
          }
        });
        reportText += `\n`;
      }

      // ИТОГИ ПО СМЕНЕ
      reportText += `━━━━━━━━━━━━━━━━━━━━━\n`;
      reportText += `👥 <b>Всего сотрудников:</b> ${employeeSummaries.length}\n`;
      if (totalOvertimePay > 0) {
        reportText += `⏱ <b>Переработки (+):</b> +${totalOvertimePay.toLocaleString("ru-RU")} ₸\n`;
      }
      if (totalLateFines > 0 || totalDeductions > 0) {
        reportText += `🛑 <b>Всего удержано (-):</b> -${(totalLateFines + totalDeductions).toLocaleString("ru-RU")} ₸\n`;
      }
      reportText += `💰 <b>ИТОГО ФОТ ЗА СМЕНУ:</b> <u><b>${totalFot.toLocaleString("ru-RU")} ₸</b></u>\n`;

      // Автоматическая выгрузка данных по ФОТ в финансовый учет clear.cut
      try {
        const { syncPayrollToClearcut } = await import("@/utils/clearcut-sync");
        await syncPayrollToClearcut({
          dateStr,
          totalAmount: totalFot,
          employeesDetails: employeeSummaries.map(e => ({
            name: e.employeeName,
            position: e.position,
            shiftRate: e.shiftRate,
            overtimePay: e.overtimePay,
            fineAmount: e.fineAmount + e.deductionAmount,
            finalPay: e.finalPay,
            hours: e.workedHoursFormatted,
          })),
        });
      } catch (ccErr) {
        console.error("clearcut sync error:", ccErr);
      }
    }

    const sendRes = await sendTelegramMessage(reportText);

    return {
      success: sendRes.success,
      error: sendRes.error,
      message: sendRes.success ? "Отчет успешно отправлен в Telegram и синхронизирован с clear.cut" : `Ошибка отправки: ${sendRes.error}`,
      shiftsCount: employeeSummaries.length,
      totalPayout: employeeSummaries.reduce((sum, e) => sum + e.finalPay, 0),
    };
  } catch (err: any) {
    console.error("generateAndSendDailyReport error:", err);
    return {
      success: false,
      error: err.message || "Неизвестная ошибка формирования отчета",
    };
  }
}
