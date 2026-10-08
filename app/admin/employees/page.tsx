import { createClient } from "@supabase/supabase-js";
import AddEmployeeSection from "@/components/AddEmployeeSection";
import EmployeeRow from "@/components/EmployeeRow";
import { getIikoEmployees } from "@/utils/iiko/client";
import { CheckCircle2, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminEmployeesPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: employees } = await supabase
    .from("profiles")
    .select("*")
    .in("role", ["employee", "admin", "manager"])
    .order("full_name", { ascending: true });

  // Безопасное получение списка сотрудников из iiko
  let iikoEmployees: any[] = [];
  let iikoError: string | null = null;
  try {
    iikoEmployees = await getIikoEmployees();
  } catch (err: any) {
    iikoError = err.message || "Ошибка подключения к серверу iiko";
    console.warn("Could not fetch iiko employees for admin page:", err.message);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Баннер статуса синхронизации с iiko */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
        iikoEmployees.length > 0 
          ? "bg-green-50/70 border-green-200 text-green-800"
          : "bg-amber-50/80 border-amber-200 text-amber-900"
      }`}>
        <div className="flex items-start gap-2.5">
          {iikoEmployees.length > 0 ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-xs font-bold">
              {iikoEmployees.length > 0
                ? `iiko подключен: загружено ${iikoEmployees.length} сотрудников`
                : `Связь с iiko: ${iikoError || "Сотрудники не получены"}`}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {iikoEmployees.length > 0
                ? "Профили доступны для автозаполнения и привязки при создании/редактировании"
                : "Проверьте права пользователя в iikoOffice (доступ к API) или откройте тест"}
            </p>
          </div>
        </div>

        <Link
          href="/api/iiko/test"
          target="_blank"
          className="inline-flex items-center text-xs font-semibold px-3 py-1.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-700 shadow-sm"
        >
          <span>Диагностика подключения</span>
          <ExternalLink className="w-3.5 h-3.5 ml-1.5 text-gray-400" />
        </Link>
      </div>

      <AddEmployeeSection 
        iikoEmployees={iikoEmployees} 
        allEmployees={employees || []} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {employees?.map((emp) => (
          <EmployeeRow 
            key={emp.id} 
            employee={emp} 
            iikoEmployees={iikoEmployees}
            allEmployees={employees || []}
          />
        ))}
        {(!employees || employees.length === 0) && (
          <div className="col-span-full bg-white p-8 rounded-2xl text-center text-gray-500 border border-gray-200">
            Сотрудников пока нет. Нажмите «+ Добавить сотрудника», чтобы создать первого сотрудника.
          </div>
        )}
      </div>
    </div>
  );
}
