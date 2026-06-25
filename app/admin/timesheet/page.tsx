import { createClient } from "@supabase/supabase-js";
import { startOfMonth, endOfMonth, parseISO, differenceInMinutes, format } from "date-fns";
import { ru } from "date-fns/locale";
import ExportCsvButton from "./ExportCsvButton";
import TimesheetRow from "@/components/admin/TimesheetRow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Вспомогательная функция для получения YYYY-MM-DD в часовом поясе Алматы (UTC+5)
function getLocalDateString(isoString: string): string {
  const date = new Date(isoString);
  const localDate = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  const yyyy = localDate.getUTCFullYear();
  const mm = String(localDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(localDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Вспомогательная функция для форматирования времени HH:mm в часовом поясе Алматы (UTC+5)
function getLocalTimeString(isoString: string): string {
  const date = new Date(isoString);
  const localDate = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  const hh = String(localDate.getUTCHours()).padStart(2, '0');
  const mm = String(localDate.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Вспомогательная функция для форматирования даты в "d MMM (EEE)" на русском
function formatLocalDate(dateStr: string, formatStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return format(date, formatStr, { locale: ru });
}

export default async function TimesheetPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const now = new Date();
  const currentMonth = searchParams.month ? parseInt(searchParams.month) : now.getMonth();
  const currentYear = searchParams.year ? parseInt(searchParams.year) : now.getFullYear();

  const startDate = startOfMonth(new Date(currentYear, currentMonth));
  const endDate = endOfMonth(startDate);

  // 1. Получаем сотрудников
  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name, shift_rate, is_overtime_enabled")
    .eq("role", "employee")
    .order("full_name");

  // 2. Получаем локации (для базовых часов, рабочего времени и штрафов за опоздание)
  const { data: locationsData } = await supabase
    .from("locations")
    .select("id, base_hours, work_start_time, work_end_time, late_fine_amount");

  const locationMap: Record<string, { base_hours: number; work_start_time: string; work_end_time: string; late_fine_amount: number }> = {};
  locationsData?.forEach(loc => {
    locationMap[loc.id] = {
      base_hours: loc.base_hours || 8,
      work_start_time: loc.work_start_time || "11:00",
      work_end_time: loc.work_end_time || "00:00",
      late_fine_amount: loc.late_fine_amount || 0
    };
  });

  // Вспомогательная функция для перевода времени HH:mm в минуты с начала дня
  const timeToMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // 3. Получаем отметки с запасом в 1 день до и после, чтобы корректно связать ночные смены
  const queryStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
  const queryEndDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);

  const { data: records } = await supabase
    .from("time_records")
    .select("*")
    .gte("recorded_at", queryStartDate.toISOString())
    .lte("recorded_at", queryEndDate.toISOString())
    .order("recorded_at", { ascending: true });

  // 3.5 Получаем решения по переработкам (свыше 3 часов)
  const { data: approvalsData } = await supabase
    .from("overtime_approvals")
    .select("*")
    .gte("record_date", format(startDate, 'yyyy-MM-dd'))
    .lte("record_date", format(endDate, 'yyyy-MM-dd'));

  // 3.7 Получаем решения по штрафам за опоздания
  const { data: fineApprovalsData } = await supabase
    .from("late_fine_approvals")
    .select("*")
    .gte("record_date", format(startDate, 'yyyy-MM-dd'))
    .lte("record_date", format(endDate, 'yyyy-MM-dd'));

  // 4. Агрегация данных
  const timesheet = employees?.map(emp => {
    const empRecords = records?.filter(r => r.employee_id === emp.id) || [];
    let completedShifts = 0;
    let missingCheckouts = 0;
    let totalOvertimeHours = 0;
    let totalWorkedHours = 0;
    let totalFines = 0;

    // Хронологическое связывание смен
    interface RawShift {
      firstIn: any | null;
      lastOut: any | null;
      representativeDate: string;
    }

    const rawShifts: RawShift[] = [];
    let currentCheckIn: any = null;

    for (let i = 0; i < empRecords.length; i++) {
      const r = empRecords[i];
      if (r.record_type === 'check_in') {
        if (currentCheckIn) {
          rawShifts.push({
            firstIn: currentCheckIn,
            lastOut: null,
            representativeDate: getLocalDateString(currentCheckIn.recorded_at)
          });
        }
        currentCheckIn = r;
      } else if (r.record_type === 'check_out') {
        if (currentCheckIn) {
          const diffHours = (new Date(r.recorded_at).getTime() - new Date(currentCheckIn.recorded_at).getTime()) / (1000 * 60 * 60);
          if (diffHours <= 20) {
            rawShifts.push({
              firstIn: currentCheckIn,
              lastOut: r,
              representativeDate: getLocalDateString(currentCheckIn.recorded_at)
            });
            currentCheckIn = null;
          } else {
            rawShifts.push({
              firstIn: currentCheckIn,
              lastOut: null,
              representativeDate: getLocalDateString(currentCheckIn.recorded_at)
            });
            rawShifts.push({
              firstIn: null,
              lastOut: r,
              representativeDate: getLocalDateString(r.recorded_at)
            });
            currentCheckIn = null;
          }
        } else {
          rawShifts.push({
            firstIn: null,
            lastOut: r,
            representativeDate: getLocalDateString(r.recorded_at)
          });
        }
      }
    }

    if (currentCheckIn) {
      rawShifts.push({
        firstIn: currentCheckIn,
        lastOut: null,
        representativeDate: getLocalDateString(currentCheckIn.recorded_at)
      });
    }

    // Оставляем только смены текущего месяца
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');
    const monthlyShifts = rawShifts.filter(s => s.representativeDate >= startStr && s.representativeDate <= endStr);

    // Группируем по дню, чтобы исключить дублирование ключей в рендере
    const groupedShifts: Record<string, RawShift[]> = {};
    monthlyShifts.forEach(s => {
      if (!groupedShifts[s.representativeDate]) {
        groupedShifts[s.representativeDate] = [];
      }
      groupedShifts[s.representativeDate].push(s);
    });

    const dailyDetails: any[] = [];

    Object.entries(groupedShifts).forEach(([day, shiftsForDay]) => {
      const mainShift = shiftsForDay[0];
      const firstIn = mainShift.firstIn?.recorded_at || null;
      const lastOut = mainShift.lastOut?.recorded_at || null;

      const formattedDay = formatLocalDate(day, "d MMM (EEE)");
      const formattedFirstIn = firstIn ? getLocalTimeString(firstIn) : "—";
      const formattedLastOut = lastOut ? getLocalTimeString(lastOut) : "—";

      // Расчет опоздания и штрафа (по первой отметке)
      let isLate = false;
      let lateMinutes = 0;
      let calculatedFine = 0;
      let fineAmount = 0;
      let fineApprovalStatus = 'none';

      const locId = mainShift.firstIn?.location_id;
      const locInfo = locId && locationMap[locId] ? locationMap[locId] : null;

      if (firstIn && locInfo) {
        const checkInTimeStr = getLocalTimeString(firstIn);
        const checkInMins = timeToMinutes(checkInTimeStr);
        const planStartMins = timeToMinutes(locInfo.work_start_time || "11:00");
        
        if (checkInMins > planStartMins) {
          isLate = true;
          lateMinutes = checkInMins - planStartMins;
          if (lateMinutes > 10) {
            const extraMinutes = lateMinutes - 10;
            const intervals = Math.ceil(extraMinutes / 5);
            calculatedFine = intervals * (locInfo.late_fine_amount || 0);
          }
        }
      }

      // Проверяем решение админа
      if (calculatedFine > 0) {
        const existingFineApproval = fineApprovalsData?.find(
          a => a.employee_id === emp.id && a.record_date === day
        );
        if (existingFineApproval) {
          fineApprovalStatus = existingFineApproval.status;
          fineAmount = existingFineApproval.status === 'approved' ? existingFineApproval.approved_fine : 0;
        } else {
          fineApprovalStatus = 'pending';
          fineAmount = calculatedFine;
        }
        totalFines += fineAmount;
      }

      // Подсчет часов
      let actualHours = 0;
      let status: 'complete' | 'missing_checkout' | 'in_progress' = 'complete';

      shiftsForDay.forEach(s => {
        if (s.firstIn && s.lastOut) {
          const actualMins = differenceInMinutes(parseISO(s.lastOut.recorded_at), parseISO(s.firstIn.recorded_at));
          actualHours += actualMins / 60;
        } else if (s.firstIn && !s.lastOut) {
          const todayDateStr = getLocalDateString(new Date().toISOString());
          if (s.representativeDate === todayDateStr) {
            status = 'in_progress';
          } else {
            status = 'missing_checkout';
          }
        } else if (!s.firstIn && s.lastOut) {
          status = 'missing_checkout';
        }
      });

      if (status === 'complete') {
        completedShifts++;
        totalWorkedHours += actualHours;

        const baseHours = locInfo ? locInfo.base_hours : 8;
        
        let calculatedOvertime = 0;
        if (emp.is_overtime_enabled !== false) {
          const rawOvertime = actualHours - (baseHours + 1);
          if (rawOvertime > 0) {
            calculatedOvertime = Math.floor(rawOvertime);
          }
        }
        
        let overtime = calculatedOvertime;
        let requiresApproval = calculatedOvertime > 3;
        let approvalStatus = 'none';

        if (requiresApproval) {
          const existingApproval = approvalsData?.find(a => a.employee_id === emp.id && a.record_date === day);
          if (existingApproval) {
            approvalStatus = existingApproval.status;
            overtime = existingApproval.status === 'approved' ? existingApproval.approved_hours : 0;
          } else {
            approvalStatus = 'pending';
            overtime = 0;
          }
        }

        totalOvertimeHours += overtime;

        dailyDetails.push({ 
          day, 
          formattedDay, 
          formattedFirstIn, 
          formattedLastOut, 
          firstIn, 
          lastOut, 
          actualHours,
          calculatedOvertime,
          overtime,
          requiresApproval,
          approvalStatus,
          isLate,
          lateMinutes,
          calculatedFine,
          fineAmount,
          fineApprovalStatus,
          status: 'complete' 
        });
      } else {
        if (status === 'missing_checkout') {
          missingCheckouts++;
        }
        dailyDetails.push({ 
          day, 
          formattedDay, 
          formattedFirstIn, 
          formattedLastOut, 
          firstIn, 
          lastOut, 
          isLate, 
          lateMinutes, 
          calculatedFine,
          fineAmount, 
          fineApprovalStatus,
          status 
        });
      }
    });

    dailyDetails.sort((a, b) => a.day.localeCompare(b.day));

    // Расчет ЗП с переработками и штрафами
    const hourlyRate = (emp.shift_rate || 0) / 8;
    const basePay = completedShifts * (emp.shift_rate || 0);
    const overtimePay = totalOvertimeHours * hourlyRate;
    const totalEarned = (basePay + overtimePay - totalFines).toFixed(0);

    return {
      ...emp,
      completedShifts,
      totalWorkedHours,
      overtimeHours: totalOvertimeHours,
      totalFines,
      totalEarned: parseInt(totalEarned),
      missingCheckouts,
      dailyDetails
    };
  }) || [];

  const periodStr = format(startDate, "yyyy_MM");

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Табель</h1>
        <div className="flex space-x-4">
          <div suppressHydrationWarning className="text-sm text-gray-500 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
            Период: {format(startDate, "LLLL yyyy", { locale: ru })}
          </div>
          <ExportCsvButton data={timesheet} month={periodStr} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ФИО</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Отработано дней</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Часы</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ставка за смену</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Переработки (ч)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Штрафы (оп.)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Незакрытые смены</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Итого к выплате</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {timesheet.map((row) => (
              <TimesheetRow key={row.id} row={row} />
            ))}
            {timesheet.length === 0 && (
              <tr suppressHydrationWarning>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Сотрудников пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
