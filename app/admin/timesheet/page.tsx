import { createClient as createAdminClient } from "@supabase/supabase-js";
import { startOfMonth, endOfMonth, parseISO, differenceInMinutes, format, eachDayOfInterval } from "date-fns";
import MonthlyTimesheetMatrix, { TimesheetDayInfo } from "@/components/admin/MonthlyTimesheetMatrix";
import MonthSelector from "./MonthSelector";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import { findMatchingWaiterTips } from "@/utils/iiko/matcher";

export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string; dateFrom?: string; dateTo?: string };
}) {
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const now = new Date();
  let startDateStr = searchParams.dateFrom;
  let endDateStr = searchParams.dateTo;
  let currentMonth = searchParams.month ? parseInt(searchParams.month) : now.getMonth();
  let currentYear = searchParams.year ? parseInt(searchParams.year) : now.getFullYear();

  if (startDateStr && endDateStr) {
    const parsedStart = parseISO(startDateStr);
    if (!isNaN(parsedStart.getTime())) {
      currentMonth = parsedStart.getMonth();
      currentYear = parsedStart.getFullYear();
    }
  } else {
    const startDate = startOfMonth(new Date(currentYear, currentMonth));
    const endDate = endOfMonth(startDate);
    startDateStr = format(startDate, "yyyy-MM-dd");
    endDateStr = format(endDate, "yyyy-MM-dd");
  }

  // Создаем интервал дней для табеля
  const startDay = parseISO(startDateStr);
  const endDay = parseISO(endDateStr);
  const rawDays = eachDayOfInterval({ start: startDay, end: endDay });
  const DOW_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  const daysList: TimesheetDayInfo[] = rawDays.map((d) => {
    const dStr = format(d, "yyyy-MM-dd");
    const dowIdx = d.getDay();
    return {
      dateStr: dStr,
      dayNum: d.getDate(),
      label: format(d, "dd.MM"),
      dayOfWeek: DOW_RU[dowIdx],
      isWeekend: dowIdx === 0 || dowIdx === 6,
    };
  });

  const periodLabel = startDateStr === endDateStr
    ? `${format(startDay, "dd.MM.yyyy")} (${DOW_RU[startDay.getDay()]})`
    : `с ${format(startDay, "dd.MM.yyyy")} по ${format(endDay, "dd.MM.yyyy")} (${daysList.length} дн.)`;

  const startIso = new Date(`${startDateStr}T00:00:00`).toISOString();
  const endIso = new Date(`${endDateStr}T23:59:59.999`).toISOString();

  // 1. Получаем сотрудников
  const { data: employees } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "employee")
    .order("department", { ascending: true })
    .order("full_name", { ascending: true });

  // 2. Получаем отметки времени за выбранный период
  const { data: records } = await supabase
    .from("time_records")
    .select("*, location:locations(name, work_start_time, work_end_time, base_hours)")
    .gte("recorded_at", startIso)
    .lte("recorded_at", endIso)
    .order("recorded_at", { ascending: true });

  // 3. Получаем авансы за выбранный период
  const { data: advances } = await supabase
    .from("advances")
    .select("*")
    .gte("date", startDateStr)
    .lte("date", endDateStr);

  // 4. Получаем удержания за месяц
  const { data: deductions } = await supabase
    .from("deductions")
    .select("*")
    .gte("date", startDateStr)
    .lte("date", endDateStr);

  // 5. Получаем штрафы за опоздания и прочие штрафы за период
  const { data: fineApprovalsData } = await supabase
    .from("late_fine_approvals")
    .select("*")
    .gte("record_date", startDateStr)
    .lte("record_date", endDateStr);

  const { data: penalties } = await supabase
    .from("penalties")
    .select("*")
    .gte("date", startDateStr)
    .lte("date", endDateStr);

  // 6. Получаем решения по переработкам / утвержденным сменам
  const { data: approvalsData } = await supabase
    .from("overtime_approvals")
    .select("*")
    .gte("record_date", startDateStr)
    .lte("record_date", endDateStr);

  // 7. Получаем проценты официантов с обслуживания из iiko (50% от 10% надбавки)
  let waiterTipsData: {
    daily: Array<{ date: string; waiterName: string; increaseSum: number; waiterBonus: number; dishSum: number }>;
    totalsByWaiter: Record<string, { increaseSum: number; waiterBonus: number; dishSum: number }>;
  } = { daily: [], totalsByWaiter: {} };

  try {
    const { getIikoWaiterServiceTips } = await import("@/utils/iiko/client");
    waiterTipsData = await getIikoWaiterServiceTips({
      dateFrom: startDateStr,
      dateTo: endDateStr,
    });
  } catch (err) {
    console.warn("Failed to load waiter tips from iiko for timesheet:", err);
  }

  // 8. Формируем матрицу данных по каждому сотруднику и каждому дню
  const matrixData: Record<string, {
    totalMinutes: number;
    days: Record<string, { minutes: number; inTime?: string; outTime?: string; status?: string; waiterTip?: number }>;
    basePay: number;
    waiterBonus: number;
    advances: number;
    deductions: number;
    penalties: number;
    earned: number;
    netPay: number;
  }> = {};

  const allEmployeesList = employees || [];

  employees?.forEach((emp) => {
    const empRecords = records?.filter((r) => r.employee_id === emp.id) || [];
    const empAdvances = advances?.filter((a) => a.employee_id === emp.id) || [];
    const empDeductions = deductions?.filter((d) => d.employee_id === emp.id) || [];
    const empPenalties = penalties?.filter((p) => p.employee_id === emp.id) || [];
    const empFineApprovals = fineApprovalsData?.filter((f) => f.employee_id === emp.id) || [];
    const empApprovals = approvalsData?.filter((a) => a.employee_id === emp.id) || [];

    const totalAdv = empAdvances
      .filter((a) => a.status === "paid" || a.status === "approved")
      .reduce((s, a) => s + parseFloat(a.amount || 0), 0);
    const totalDed = empDeductions.reduce((s, d) => s + parseFloat(d.amount || 0), 0);
    const totalLateFines = empFineApprovals
      .filter((f) => f.status === "approved" || f.status === "pending")
      .reduce((s, f) => s + parseFloat(f.approved_fine || f.calculated_fine || 0), 0);
    const totalPen = empPenalties.reduce((s, p) => s + parseFloat(p.amount || 0), 0) + totalLateFines;

    // Проценты с обслуживания iiko начисляются ТОЛЬКО официантам!
    // У менеджеров, управляющих, администрации, кухни, бара и т.д. проценты НЕ начисляются.
    const pos = (emp.position || "").toLowerCase();
    const dept = (emp.department || "").toLowerCase();
    const isManager = pos.includes("менеджер") || pos.includes("управляющ") || pos.includes("администратор") || pos.includes("директор") || dept.includes("администрац");
    const isWaiter = !isManager && (pos.includes("официант") || pos.includes("waiter") || pos.includes("раннер") || (emp.department === "Зал" && !isManager));

    let waiterBonus = 0;
    let waiterDailyTips: Record<string, number> = {};

    if (isWaiter) {
      const matched = findMatchingWaiterTips(
        emp.full_name,
        waiterTipsData,
        allEmployeesList
      );
      waiterBonus = matched.totalBonus;
      waiterDailyTips = matched.dailyTips;
    }

    let totalMinutes = 0;
    let completedShiftsCount = 0;
    let totalOvertimeHours = 0;
    const daysMap: Record<string, { minutes: number; inTime?: string; outTime?: string; status?: string; waiterTip?: number }> = {};

    // Группируем по датам (YYYY-MM-DD)
    const dayGroups: Record<string, typeof empRecords> = {};
    empRecords.forEach((r) => {
      const dStr = format(new Date(r.recorded_at), "yyyy-MM-dd");
      if (!dayGroups[dStr]) dayGroups[dStr] = [];
      dayGroups[dStr].push(r);
    });

    // Также учитываем дни, когда у официанта были продажи/проценты в iiko
    Object.keys(waiterDailyTips).forEach((dStr) => {
      if (!dayGroups[dStr]) dayGroups[dStr] = [];
    });

    Object.entries(dayGroups).forEach(([dayDateStr, dayRecs]) => {
      const dailyTip = waiterDailyTips[dayDateStr] || 0;

      const checkIns = dayRecs.filter((r) => r.record_type === "check_in");
      const checkOuts = dayRecs.filter((r) => r.record_type === "check_out");

      const firstIn = checkIns[0]?.recorded_at;
      const lastOut = checkOuts[checkOuts.length - 1]?.recorded_at;

      let shiftMultiplier = 1.0;
      let overtime = 0;
      const approval = empApprovals.find((a) => a.record_date === dayDateStr);
      if (approval && approval.status === "approved") {
        const val = approval.approved_hours || 0;
        if (val === 5) shiftMultiplier = 0.5;
        else if (val === 15) shiftMultiplier = 1.5;
        else if (val === 20) shiftMultiplier = 2.0;
        else if (val === 10 || val === 1) shiftMultiplier = 1.0;
        else if (val > 100) overtime = val - 100;
        else overtime = val;
      }

      if (firstIn && lastOut) {
        const mins = differenceInMinutes(parseISO(lastOut), parseISO(firstIn));
        if (mins > 0) {
          totalMinutes += mins;
          if (approval && approval.status === "approved") {
            completedShiftsCount += shiftMultiplier;
            totalOvertimeHours += overtime;
          } else {
            completedShiftsCount += mins >= 6 * 60 ? 1 : mins / (8 * 60);
          }

          daysMap[dayDateStr] = {
            minutes: mins,
            inTime: new Date(firstIn).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
            outTime: new Date(lastOut).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
            status: "complete",
            waiterTip: dailyTip,
          };
        }
      } else if (firstIn) {
        // Если смена в процессе или не закрыта
        daysMap[dayDateStr] = {
          minutes: 0,
          inTime: new Date(firstIn).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
          status: "in_progress",
          waiterTip: dailyTip,
        };
      } else if (dailyTip > 0) {
        // Зафиксированы чаевые/бонус в iiko
        daysMap[dayDateStr] = {
          minutes: 0,
          status: "waiter_sales",
          waiterTip: dailyTip,
        };
      }
    });

    const shiftRate = emp.shift_rate || 0;
    const hourlyRate = shiftRate / 8;
    const basePay = Math.round((completedShiftsCount * shiftRate) + (totalOvertimeHours * hourlyRate));
    const earned = basePay + waiterBonus;
    const netPay = Math.max(0, earned - totalAdv - totalDed - totalPen);

    matrixData[emp.id] = {
      totalMinutes,
      days: daysMap,
      basePay,
      waiterBonus,
      advances: totalAdv,
      deductions: totalDed,
      penalties: totalPen,
      earned,
      netPay,
    };
  });

  const departments = Array.from(new Set(employees?.map((e) => e.department || "Кухня") || []));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Табель и учет смен</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Сводный табель отработанных часов и расчетов по зарплате
          </p>
        </div>

        <MonthSelector 
          currentMonth={currentMonth} 
          currentYear={currentYear} 
          dateFrom={startDateStr}
          dateTo={endDateStr}
        />
      </div>

      <MonthlyTimesheetMatrix
        employees={employees || []}
        days={daysList}
        periodLabel={periodLabel}
        dateFrom={startDateStr}
        dateTo={endDateStr}
        matrixData={matrixData}
        departments={departments}
      />
    </div>
  );
}
