import { createClient } from "@supabase/supabase-js";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import DeleteRecordButton from "./DeleteRecordButton";
import AddRecordModal from "./AddRecordModal";
import LocalTime from "@/components/LocalTime";
import ResetAttendanceButton from "./ResetAttendanceButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AttendancePage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Получаем отметки (последние 500)
  const { data: records } = await supabase
    .from("time_records")
    .select(`
      id,
      recorded_at,
      record_type,
      employee_id,
      location_id,
      profiles (id, full_name),
      locations (name)
    `)
    .order("recorded_at", { ascending: false })
    .limit(500);

  const { data: employees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "employee")
    .order("full_name");

  // Подсветка незакрытых смен с поддержкой ночных смен:
  // Группируем отметки по сотрудникам и сортируем по возрастанию времени
  const empRecordsMap: Record<string, any[]> = {};
  records?.forEach(r => {
    if (!empRecordsMap[r.employee_id]) {
      empRecordsMap[r.employee_id] = [];
    }
    empRecordsMap[r.employee_id].push(r);
  });

  const errorRecordIds = new Set<string>();
  const currentTime = new Date();

  Object.values(empRecordsMap).forEach(empRecs => {
    const sorted = [...empRecs].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      if (current.record_type === 'check_in') {
        const next = sorted[i + 1];
        let hasCheckout = false;
        if (next && next.record_type === 'check_out') {
          const diffHours = (new Date(next.recorded_at).getTime() - new Date(current.recorded_at).getTime()) / (1000 * 60 * 60);
          if (diffHours <= 20) {
            hasCheckout = true;
          }
        }
        
        if (!hasCheckout) {
          // Если ухода нет, подсвечиваем ошибку только если смена длится уже больше 16 часов
          const diffFromNow = (currentTime.getTime() - new Date(current.recorded_at).getTime()) / (1000 * 60 * 60);
          if (diffFromNow > 16) {
            errorRecordIds.add(current.id);
          }
        }
      }
    }
  });

  const recordsWithErrors = records?.map(record => {
    const isError = errorRecordIds.has(record.id);
    return { ...record, isError };
  }) || [];

  // Группировка по сотрудникам
  const groupedByEmployee: Record<string, { employeeName: string, employeeId: string, records: any[] }> = {};
  
  recordsWithErrors.forEach(record => {
    const empId = record.employee_id;
    if (!groupedByEmployee[empId]) {
      groupedByEmployee[empId] = {
        employeeId: empId,
        employeeName: (record.profiles as any)?.full_name || "Неизвестно",
        records: []
      };
    }
    groupedByEmployee[empId].records.push(record);
  });

  const groupedArray = Object.values(groupedByEmployee).sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Журнал отметок</h1>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <ResetAttendanceButton />
          <AddRecordModal employees={employees || []} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groupedArray.map(group => (
          <div key={group.employeeId} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[600px]">
            <div className="bg-gray-50 px-5 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10">
               <h3 className="font-bold text-gray-900 truncate pr-2">{group.employeeName}</h3>
               <span className="bg-primary/10 text-primary text-xs px-3 py-1 rounded-full font-bold whitespace-nowrap">
                 {group.records.length} {group.records.length === 1 ? 'отметка' : 'отметок'}
               </span>
            </div>
            <div className="p-0 flex-1 overflow-y-auto custom-scrollbar">
              <ul className="divide-y divide-gray-100">
                {group.records.map(record => (
                  <li key={record.id} className={`p-5 flex flex-col hover:bg-gray-50 transition-colors ${record.isError ? "bg-red-50/30" : ""}`}>
                     <div className="flex justify-between items-start mb-2.5">
                       <span className={`px-2.5 py-1 text-[10px] uppercase font-black tracking-wider rounded-full ${
                          record.record_type === "check_in" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {record.record_type === "check_in" ? "Приход" : "Уход"}
                        </span>
                        <div className="text-gray-900 font-bold">
                          <LocalTime isoString={record.recorded_at} formatStr="dd MMM, HH:mm" />
                        </div>
                     </div>
                     <div className="flex justify-between items-end mt-1">
                       <div className="text-xs text-gray-500 font-medium">📍 {(record.locations as any)?.name || "Неизвестно"}</div>
                       <DeleteRecordButton recordId={record.id} />
                     </div>
                     {record.isError && <div className="text-xs text-red-500 font-bold mt-3 bg-red-50 p-2 rounded-lg text-center border border-red-100">⚠️ Нет отметки об уходе</div>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
        {groupedArray.length === 0 && (
           <div className="col-span-full bg-white p-12 rounded-2xl text-center text-gray-500 border border-gray-200">
             <p className="text-lg font-medium text-gray-900 mb-1">Отметок пока нет</p>
             <p className="text-sm">Сотрудники еще не сканировали QR-код</p>
           </div>
        )}
      </div>
    </div>
  );
}
