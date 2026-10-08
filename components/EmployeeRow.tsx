"use client";

import { useState } from "react";
import { updateEmployee } from "@/app/actions/employees";
import { Link2, CheckCircle2, AlertCircle, Star, Users, Shield } from "lucide-react";
import { formatDisplayName, formatPositionName } from "@/utils/formatters";

interface IikoEmp {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  code?: string;
  mainRoleCode?: string;
}

const DEPARTMENTS = ["Кухня", "Зал", "Бар", "Тех. персонал", "Администрация"];

export default function EmployeeRow({ 
  employee,
  iikoEmployees = [],
  allEmployees = [],
}: { 
  employee: any;
  iikoEmployees?: IikoEmp[];
  allEmployees?: any[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedIikoId, setSelectedIikoId] = useState(employee.iiko_user_id || "");
  const [department, setDepartment] = useState(employee.department || "Кухня");
  const [isLead, setIsLead] = useState(Boolean(employee.is_lead));
  const [role, setRole] = useState<"employee" | "admin">(employee.role === "admin" ? "admin" : "employee");
  
  const initialIsCustom = Boolean(employee.lead_department?.startsWith("ids:"));
  const [leadMode, setLeadMode] = useState<"department" | "custom">(initialIsCustom ? "custom" : "department");
  const [leadDepartment, setLeadDepartment] = useState(
    initialIsCustom ? "Кухня" : (employee.lead_department || employee.department || "Кухня")
  );
  
  const [selectedSubordinates, setSelectedSubordinates] = useState<string[]>(() => {
    if (initialIsCustom) {
      return employee.lead_department.replace("ids:", "").split(",").filter(Boolean);
    }
    return [];
  });

  const handleIikoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedIikoId(e.target.value);
  };

  const toggleSubordinate = (id: string) => {
    setSelectedSubordinates((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.append("id", employee.id);
    formData.set("iikoUserId", selectedIikoId);
    formData.set("department", department);
    formData.set("role", role);
    formData.set("isLead", isLead ? "true" : "false");

    if (isLead) {
      if (leadMode === "custom") {
        formData.set("leadDepartment", "ids:" + selectedSubordinates.join(","));
      } else {
        formData.set("leadDepartment", leadDepartment);
      }
    } else {
      formData.set("leadDepartment", "");
    }

    try {
      const result = await updateEmployee(formData);
      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        setLoading(false);
        setIsEditing(false);
        window.location.reload();
      }
    } catch (err: any) {
      setError("Непредвиденная ошибка: " + err.message);
      setLoading(false);
    }
  };

  const displayName = formatDisplayName(employee.full_name);
  const displayPosition = formatPositionName(employee.position);

  const isCustomLead = employee.is_lead && employee.lead_department?.startsWith("ids:");
  const customCount = isCustomLead 
    ? employee.lead_department.replace("ids:", "").split(",").filter(Boolean).length 
    : 0;

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition-shadow flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{displayName}</h3>
                {employee.role === "admin" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                    💻 Дашборд
                  </span>
                )}
                {employee.is_lead && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-md">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    {isCustomLead ? `Старший (${customCount} сотр.)` : `Старший (${employee.lead_department || "Все"})`}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                {displayPosition} • <span className="font-medium text-gray-700 dark:text-slate-300">{employee.department || "Кухня"}</span>
              </p>
            </div>
            <span className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full ${
              employee.is_active 
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" 
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            }`}>
              {employee.is_active ? "Активен" : "Отключен"}
            </span>
          </div>
          
          <div className="mt-3 space-y-2 text-xs text-gray-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-slate-500">PIN-код:</span>
              <span className="font-mono font-bold tracking-wider text-sm text-gray-900 dark:text-white">{employee.pin_code || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-slate-500">Телефон:</span>
              <span className="text-gray-800 dark:text-slate-300">{employee.phone || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-slate-500">Ставка:</span>
              <span className="font-bold text-gray-900 dark:text-white">{employee.shift_rate?.toLocaleString("ru-RU")} ₸</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-gray-100 dark:border-slate-800">
              <span className="text-gray-400 dark:text-slate-500">Связь с iiko:</span>
              {employee.iiko_user_id ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Привязан
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Нет привязки
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs font-bold text-primary hover:text-primary/80 transition-colors p-1"
          >
            Редактировать
          </button>
        </div>
      </div>

      {/* Модалка редактирования */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in-95 duration-150 border border-gray-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Редактирование сотрудника</h2>
              <button 
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 text-xs rounded-xl border border-red-100 dark:border-red-900 font-medium">
                  {error}
                </div>
              )}

              {/* Привязка к iiko */}
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl">
                <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-indigo-600" />
                  <span>Привязка к профилю iiko</span>
                </label>
                <select
                  value={selectedIikoId}
                  onChange={handleIikoChange}
                  className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-xl font-medium text-gray-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="">-- Без привязки к iiko --</option>
                  {iikoEmployees.map((emp) => {
                    const iikoName = `${emp.lastName || ""} ${emp.firstName || ""}`.trim() || emp.id;
                    const extra = [emp.mainRoleCode, emp.phone, emp.code ? `таб. №${emp.code}` : null]
                      .filter(Boolean)
                      .join(" • ");

                    return (
                      <option key={emp.id} value={emp.id}>
                        {iikoName} {extra ? `(${extra})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">ФИО</label>
                <input
                  name="fullName"
                  type="text"
                  required
                  defaultValue={employee.full_name}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm font-semibold text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">PIN-код (5 цифр)</label>
                <input
                  name="pinCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={5}
                  required
                  defaultValue={employee.pin_code}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl font-mono tracking-widest text-lg font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Отдел</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:outline-none text-gray-900 dark:text-white"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Должность</label>
                <input
                  name="position"
                  type="text"
                  defaultValue={employee.position || ""}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Телефон</label>
                <input
                  name="phone"
                  type="tel"
                  defaultValue={employee.phone || ""}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1">Ставка за смену (₸)</label>
                <input
                  name="shiftRate"
                  type="number"
                  min="0"
                  step="100"
                  defaultValue={employee.shift_rate || ""}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-bold text-sm text-gray-900 dark:text-white"
                />
              </div>

              {/* Уровень доступа (Сотрудник vs Управляющий/Админ) */}
              <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl space-y-3">
                <div>
                  <label className="text-xs font-bold text-blue-950 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span>Уровень доступа</span>
                  </label>
                  <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                    Определяет, куда может заходить сотрудник
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("employee")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      role === "employee"
                        ? "bg-white dark:bg-slate-800 border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                        : "bg-white/60 dark:bg-slate-850 border-gray-200 dark:border-slate-800 text-gray-500 opacity-70"
                    }`}
                  >
                    <div className="font-bold text-xs text-gray-900 dark:text-white">📱 Сотрудник</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Только PWA</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("admin")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      role === "admin"
                        ? "bg-white dark:bg-slate-800 border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm"
                        : "bg-white/60 dark:bg-slate-850 border-gray-200 dark:border-slate-800 text-gray-500 opacity-70"
                    }`}
                  >
                    <div className="font-bold text-xs text-indigo-900 dark:text-indigo-300">💻 Управляющий</div>
                    <div className="text-[10px] text-indigo-700 dark:text-indigo-300 mt-0.5">Дашборд /admin</div>
                  </button>
                </div>
              </div>

              {/* Назначение Старшим смены */}
              <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="editIsLeadCheck"
                    checked={isLead}
                    onChange={(e) => setIsLead(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                  />
                  <label htmlFor="editIsLeadCheck" className="text-xs font-bold text-amber-950 dark:text-amber-300 flex items-center gap-1 cursor-pointer">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Старший / Руководитель смены</span>
                  </label>
                </div>

                {isLead && (
                  <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/50 space-y-3">
                    {/* Режим: по отделу или конкретные сотрудники */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setLeadMode("department")}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                          leadMode === "department"
                            ? "bg-amber-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-amber-200 dark:border-slate-700"
                        }`}
                      >
                        По отделу
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeadMode("custom")}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                          leadMode === "custom"
                            ? "bg-amber-600 text-white shadow-sm"
                            : "bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-amber-200 dark:border-slate-700"
                        }`}
                      >
                        Закрепить сотрудников ({selectedSubordinates.length})
                      </button>
                    </div>

                    {leadMode === "department" ? (
                      <div>
                        <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-300 mb-1">
                          Зона контроля (Отдел)
                        </label>
                        <select
                          value={leadDepartment}
                          onChange={(e) => setLeadDepartment(e.target.value)}
                          className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-slate-700 rounded-xl font-bold text-gray-800 dark:text-slate-200 focus:outline-none"
                        >
                          <option value="Кухня">🍳 Кухня</option>
                          <option value="Зал">🍽️ Зал</option>
                          <option value="Бар">☕ Бар</option>
                          <option value="Тех. персонал">🧹 Тех. персонал</option>
                          <option value="Все">🏢 Все сотрудники точки</option>
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-300">
                          Выберите сотрудников, за которых отвечает старший:
                        </label>
                        <div className="max-h-40 overflow-y-auto bg-white dark:bg-slate-800 p-2 rounded-xl border border-amber-300 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
                          {allEmployees
                            .filter((emp) => emp.id !== employee.id)
                            .map((sub) => {
                              const isChecked = selectedSubordinates.includes(sub.id);
                              return (
                                <label
                                  key={sub.id}
                                  className="flex items-center justify-between p-1.5 hover:bg-amber-50/50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleSubordinate(sub.id)}
                                      className="w-3.5 h-3.5 text-amber-600 rounded"
                                    />
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                      {formatDisplayName(sub.full_name)}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-gray-400">
                                    {formatPositionName(sub.position)} • {sub.department}
                                  </span>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center pt-2">
                <input
                  name="isOvertimeEnabled"
                  type="checkbox"
                  value="true"
                  defaultChecked={employee.is_overtime_enabled !== false}
                  id="isOvertimeCheck"
                  className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                />
                <label htmlFor="isOvertimeCheck" className="ml-2 text-xs font-medium text-gray-700 dark:text-slate-300 select-none">
                  Начислять переработки
                </label>
              </div>

              <div className="flex items-center">
                <input
                  name="isActive"
                  type="checkbox"
                  value="true"
                  defaultChecked={employee.is_active}
                  id="isActiveCheck"
                  className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                />
                <label htmlFor="isActiveCheck" className="ml-2 text-xs font-medium text-gray-700 dark:text-slate-300 select-none">
                  Активный сотрудник
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-gray-200"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {loading ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
