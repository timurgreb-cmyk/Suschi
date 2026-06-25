import { createClient } from "@supabase/supabase-js";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { ru } from "date-fns/locale";
import FinesListClient from "@/components/admin/FinesListClient";
import FinesMonthSelector from "@/components/admin/FinesMonthSelector";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Вспомогательные функции для работы с датами и часовым поясом UTC+5 (Алматы)
function getLocalDateString(isoString: string): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const localDate = new Date(date.getTime() + 5 * 60 * 60 * 1000);
    const yyyy = localDate.getUTCFullYear();
    const mm = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch (e) {
    return "";
  }
}

function getLocalTimeString(isoString: string): string {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "—";
    const localDate = new Date(date.getTime() + 5 * 60 * 60 * 1000);
    const hh = String(localDate.getUTCHours()).padStart(2, '0');
    const mm = String(localDate.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch (e) {
    return "—";
  }
}

function formatLocalDate(dateStr: string, formatStr: string) {
  if (!dateStr || dateStr.includes("NaN")) return "—";
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return "—";
    return format(date, formatStr, { locale: ru });
  } catch (e) {
    return "—";
  }
}

export default async function FinesPage({
  searchParams,
}: {
  searchParams?: { month?: string; year?: string };
}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const currentMonth = searchParams?.month ? parseInt(searchParams.month) : now.getMonth();
  const currentYear = searchParams?.year ? parseInt(searchParams.year) : now.getFullYear();

  const startDate = startOfMonth(new Date(currentYear, currentMonth));
  const endDate = endOfMonth(startDate);

  // 1. Получаем сотрудников
  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "employee")
    .order("full_name");

  // 2. Получаем локации
  const { data: locationsData } = await supabase
    .from("locations")
    .select("id, name, work_start_time, late_fine_amount");

  const locationMap: Record<string, { name: string; work_start_time: string; late_fine_amount: number }> = {};
  locationsData?.forEach(loc => {
    locationMap[loc.id] = {
      name: loc.name,
      work_start_time: loc.work_start_time || "11:00",
      late_fine_amount: Number(loc.late_fine_amount) || 0
    };
  });

  // Вспомогательная функция для перевода времени HH:mm в минуты
  const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // 3. Получаем отметки прихода с запасом в 1 день
  const queryStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
  const queryEndDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);

  const { data: records } = await supabase
    .from("time_records")
    .select("*")
    .eq("record_type", "check_in")
    .gte("recorded_at", queryStartDate.toISOString())
    .lte("recorded_at", queryEndDate.toISOString())
    .order("recorded_at", { ascending: true });

  // 4. Получаем решения по штрафам за опоздания
  const { data: fineApprovals } = await supabase
    .from("late_fine_approvals")
    .select("*")
    .gte("record_date", format(startDate, 'yyyy-MM-dd'))
    .lte("record_date", format(endDate, 'yyyy-MM-dd'));

  // 5. Выделяем штрафы
  const finesList: any[] = [];
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  employees?.forEach(emp => {
    const empRecords = records?.filter(r => r.employee_id === emp.id) || [];
    
    // Группируем отметки по дням
    const days: Record<string, typeof empRecords> = {};
    empRecords.forEach(r => {
      const day = getLocalDateString(r.recorded_at);
      if (day) {
        if (!days[day]) days[day] = [];
        days[day].push(r);
      }
    });

    Object.entries(days).forEach(([day, dayRecords]) => {
      if (!dayRecords || dayRecords.length === 0) return;
      const firstInRec = dayRecords[0];
      if (!firstInRec || !firstInRec.location_id) return;
      const locInfo = locationMap[firstInRec.location_id];
      if (!locInfo) return;

      const checkInTimeStr = getLocalTimeString(firstInRec.recorded_at);
      const checkInMins = timeToMinutes(checkInTimeStr);
      const planStartMins = timeToMinutes(locInfo.work_start_time);

      if (checkInMins > planStartMins) {
        const lateMinutes = checkInMins - planStartMins;
        
        // Штраф считается только если опоздание больше 10 минут
        if (lateMinutes > 10) {
          const extraMinutes = lateMinutes - 10;
          const intervals = Math.ceil(extraMinutes / 5);
          const calculatedFine = intervals * (locInfo.late_fine_amount || 0);

          if (calculatedFine > 0) {
            // Проверяем, есть ли решение админа
            const approval = fineApprovals?.find(
              a => a.employee_id === emp.id && a.record_date === day
            );

            const approvalStatus = approval ? approval.status : 'pending';
            const fineAmount = approval ? Number(approval.approved_fine) : calculatedFine;

            // Фильтруем по выбранному месяцу по representativeDate (day)
            if (day >= startStr && day <= endStr) {
              finesList.push({
                employeeId: emp.id,
                employeeName: emp.full_name,
                day,
                formattedDay: formatLocalDate(day, "d MMMM (EEE)"),
                locationName: locInfo.name,
                formattedFirstIn: checkInTimeStr,
                planStart: locInfo.work_start_time,
                lateMinutes,
                calculatedFine,
                fineAmount,
                approvalStatus
              });
            }
          }
        }
      }
    });
  });

  // Сортировка по дате (сначала новые)
  finesList.sort((a, b) => b.day.localeCompare(a.day));

  const periodStr = format(startDate, "yyyy_MM");

  // Месяцы для переключения
  const monthsList = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), i, 1);
    return {
      value: i,
      label: format(d, "LLLL", { locale: ru })
    };
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Штрафы за опоздания</h1>
          <p className="text-sm text-gray-500 mt-1">
            Управление и подтверждение штрафов за опоздание сотрудников
          </p>
        </div>

        {/* Month Selector */}
        <FinesMonthSelector 
          currentMonth={currentMonth} 
          currentYear={currentYear} 
          monthsList={monthsList} 
        />
      </div>

      <FinesListClient fines={finesList} monthStr={periodStr} />
    </div>
  );
}
