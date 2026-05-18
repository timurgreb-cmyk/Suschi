import { createClient } from "@supabase/supabase-js";
import { startOfMonth, endOfMonth, parseISO, differenceInMinutes, format } from "date-fns";
import { ru } from "date-fns/locale";
import ExportCsvButton from "./ExportCsvButton";
import TimesheetRow from "@/components/admin/TimesheetRow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  // 3. Получаем отметки за месяц
  const { data: records } = await supabase
    .from("time_records")
    .select("*")
    .gte("recorded_at", startDate.toISOString())
    .lte("recorded_at", endDate.toISOString())
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

    // Группируем по дням
    const days: Record<string, typeof empRecords> = {};
    empRecords.forEach(r => {
      const day = format(parseISO(r.recorded_at), 'yyyy-MM-dd');
      if (!days[day]) days[day] = [];
      days[day].push(r);
    });

    const dailyDetails: any[] = [];

    Object.entries(days).forEach(([day, dayRecords]) => {
      const dayCheckIns = dayRecords.filter(r => r.record_type === 'check_in');
      const dayCheckOuts = dayRecords.filter(r => r.record_type === 'check_out');

      const firstInRec = dayCheckIns.length > 0 ? dayCheckIns[0] : null;
      const lastOutRec = dayCheckOuts.length > 0 ? dayCheckOuts[dayCheckOuts.length - 1] : null;

      const firstIn = firstInRec?.recorded_at || null;
      const lastOut = lastOutRec?.recorded_at || null;

      const formattedDay = format(parseISO(day), "d MMM (EEE)", { locale: ru });
      const formattedFirstIn = firstIn ? format(parseISO(firstIn), "HH:mm") : "—";
      const formattedLastOut = lastOut ? format(parseISO(lastOut), "HH:mm") : "—";

      // Расчет опоздания и штрафа
      let isLate = false;
      let lateMinutes = 0;
      let calculatedFine = 0;
      let fineAmount = 0;
      let fineApprovalStatus = 'none';

      const locId = firstInRec?.location_id;
      const locInfo = locId && locationMap[locId] ? locationMap[locId] : null;

      if (firstIn && locInfo) {
        const checkInTimeStr = format(parseISO(firstIn), "HH:mm");
        const checkInMins = timeToMinutes(checkInTimeStr);
        const planStartMins = timeToMinutes(locInfo.work_start_time || "11:00");
        
        if (checkInMins > planStartMins) {
          isLate = true;
          lateMinutes = checkInMins - planStartMins;
          // Штраф начисляется только если опоздание больше 15 минут. 
          // За каждые 5 минут опоздания начисляется установленный тариф (например 3000 ₸)
          if (lateMinutes > 15) {
            const extraMinutes = lateMinutes - 15;
            const intervals = Math.ceil(extraMinutes / 5);
            calculatedFine = intervals * (locInfo.late_fine_amount || 0);
          }
        }
      }

      // Проверяем ручное решение админа по штрафу
      if (calculatedFine > 0) {
        const existingFineApproval = fineApprovalsData?.find(
          a => a.employee_id === emp.id && a.record_date === day
        );
        if (existingFineApproval) {
          fineApprovalStatus = existingFineApproval.status;
          fineAmount = existingFineApproval.status === 'approved' ? existingFineApproval.approved_fine : 0;
        } else {
          fineApprovalStatus = 'pending';
          fineAmount = calculatedFine; // Показываем расчетный, пока не принято решение
        }
        totalFines += fineAmount;
      }

      if (firstIn && lastOut) {
        completedShifts++;
        
        // Считаем часы
        const actualMins = differenceInMinutes(parseISO(lastOut), parseISO(firstIn));
        const actualHours = actualMins / 60;
        
        totalWorkedHours += actualHours;

        // Получаем базу из локации прихода
        const baseHours = locInfo ? locInfo.base_hours : 8;
        
        let calculatedOvertime = 0;
        if (emp.is_overtime_enabled !== false) {
          // 1 час идет как обед, т.е. отнимаем (baseHours + 1)
          const rawOvertime = actualHours - (baseHours + 1);
          if (rawOvertime > 0) {
            // Переработки считаются только за целый час
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
            overtime = 0; // Пока не одобрено, не начисляем
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
      } else if (firstIn && !lastOut) {
        const isToday = day === new Date().toISOString().split('T')[0];
        if (!isToday) {
          missingCheckouts++;
          dailyDetails.push({ 
            day, 
            formattedDay, 
            formattedFirstIn, 
            formattedLastOut, 
            firstIn, 
            lastOut: null, 
            isLate, 
            lateMinutes, 
            calculatedFine,
            fineAmount, 
            fineApprovalStatus,
            status: 'missing_checkout' 
          });
        } else {
          dailyDetails.push({ 
            day, 
            formattedDay, 
            formattedFirstIn, 
            formattedLastOut, 
            firstIn, 
            lastOut: null, 
            isLate, 
            lateMinutes, 
            calculatedFine,
            fineAmount, 
            fineApprovalStatus,
            status: 'in_progress' 
          });
        }
      }
    });

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
