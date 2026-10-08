"use client";

import { useState, useEffect } from "react";
import { createEmployee } from "@/app/actions/employees";
import { getIikoStaffList } from "@/app/actions/iiko";
import { Loader2, Link2, Sparkles, ShieldAlert, Star, Shield } from "lucide-react";
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

export default function AddEmployeeForm({ 
  onSuccess,
  iikoEmployees: initialIikoEmployees = [],
  allEmployees = []
}: { 
  onSuccess: () => void;
  iikoEmployees?: IikoEmp[];
  allEmployees?: any[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iikoEmployees, setIikoEmployees] = useState<IikoEmp[]>(initialIikoEmployees);
  const [loadingIiko, setLoadingIiko] = useState(false);

  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("Кухня");
  const [phone, setPhone] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [shiftRate, setShiftRate] = useState("0");
  const [iikoUserId, setIikoUserId] = useState("");
  const [role, setRole] = useState<"employee" | "admin">("employee");

  // Lead / Senior
  const [isLead, setIsLead] = useState(false);
  const [leadMode, setLeadMode] = useState<"department" | "custom">("department");
  const [leadDepartment, setLeadDepartment] = useState("Кухня");
  const [selectedSubordinates, setSelectedSubordinates] = useState<string[]>([]);

  useEffect(() => {
    if (initialIikoEmployees.length === 0) {
      setLoadingIiko(true);
      getIikoStaffList()
        .then((res) => {
          if (res.success && res.employees) {
            setIikoEmployees(res.employees);
          }
        })
        .finally(() => setLoadingIiko(false));
    }
  }, [initialIikoEmployees]);

  const handleSelectIikoEmployee = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      setIikoUserId("");
      return;
    }

    const matched = iikoEmployees.find((emp) => emp.id === selectedId);
    if (matched) {
      setIikoUserId(matched.id);
      const name = `${matched.lastName || ""} ${matched.firstName || ""}`.trim();
      if (name) setFullName(name);
      if (matched.phone) setPhone(matched.phone);
      if (matched.mainRoleCode) {
        setPosition(matched.mainRoleCode);
        const roleLower = matched.mainRoleCode.toLowerCase();
        if (roleLower.includes("повар") || roleLower.includes("шеф") || roleLower.includes("кухн")) {
          setDepartment("Кухня");
          if (roleLower.includes("шеф") || roleLower.includes("су-шеф") || roleLower.includes("старш")) {
            setIsLead(true);
            setLeadDepartment("Кухня");
          }
        } else if (roleLower.includes("официант") || roleLower.includes("хостес") || roleLower.includes("раннер")) {
          setDepartment("Зал");
        } else if (roleLower.includes("бар") || roleLower.includes("барист")) {
          setDepartment("Бар");
        } else if (roleLower.includes("посуд") || roleLower.includes("убор") || roleLower.includes("тех")) {
          setDepartment("Тех. персонал");
        } else if (roleLower.includes("управ") || roleLower.includes("админ") || roleLower.includes("директор") || roleLower.includes("менеджер")) {
          setDepartment("Администрация");
          setRole("admin");
          setIsLead(true);
          setLeadDepartment("Все");
        }
      }
      if (matched.code && /^\d{5}$/.test(matched.code)) {
        setPinCode(matched.code);
      }
    }
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
    
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("isLead", isLead ? "true" : "false");
      formData.set("role", role);
      
      if (isLead) {
        if (leadMode === "custom") {
          formData.set("leadDepartment", "ids:" + selectedSubordinates.join(","));
        } else {
          formData.set("leadDepartment", leadDepartment);
        }
      } else {
        formData.set("leadDepartment", "");
      }
      
      const result = await createEmployee(formData);
      
      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        setLoading(false);
        onSuccess();
      }
    } catch (err: any) {
      setError("Непредвиденная ошибка: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 mt-6 animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Создать сотрудника</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Заполните данные или выберите профиль из iiko для автопривязки
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-5 text-red-600 dark:text-red-300 text-xs bg-red-50 dark:bg-red-950/50 p-3.5 rounded-xl border border-red-100 dark:border-red-900 font-medium">
          {error}
        </div>
      )}

      {/* Выбор из iiko */}
      <div className="mb-5 p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl">
        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-indigo-900 dark:text-indigo-300">
          <Link2 className="w-4 h-4 text-indigo-600" />
          <span>Быстрое заполнение из iiko</span>
          {loadingIiko && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 ml-1" />}
        </div>
        <select
          value={iikoUserId}
          onChange={handleSelectIikoEmployee}
          className="w-full text-xs p-2.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none font-medium text-gray-800 dark:text-slate-200"
        >
          <option value="">-- Выбрать сотрудника из iiko для привязки --</option>
          {iikoEmployees.map((emp) => {
            const displayName = `${emp.lastName || ""} ${emp.firstName || ""}`.trim() || emp.id;
            const extra = [emp.mainRoleCode, emp.phone, emp.code ? `таб. №${emp.code}` : null]
              .filter(Boolean)
              .join(" • ");

            return (
              <option key={emp.id} value={emp.id}>
                {displayName} {extra ? `(${extra})` : ""}
              </option>
            );
          })}
        </select>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="iikoUserId" value={iikoUserId} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              ФИО *
            </label>
            <input
              required
              type="text"
              name="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Алмат Долинбаев"
              className="w-full text-sm p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-semibold text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              PIN-код (5 цифр) *
            </label>
            <input
              required
              type="text"
              name="pinCode"
              pattern="\d{5}"
              maxLength={5}
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              placeholder="12345"
              className="w-full text-sm p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-mono tracking-widest text-lg font-bold text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Отдел *
            </label>
            <select
              name="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full text-sm p-2.5 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-semibold text-gray-900 dark:text-white"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Должность
            </label>
            <input
              type="text"
              name="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Шеф-повар / Повар"
              className="w-full text-sm p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Телефон
            </label>
            <input
              type="text"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 (700) 000-00-00"
              className="w-full text-sm p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Ставка за смену (₸) *
            </label>
            <input
              required
              type="number"
              step="1"
              name="shiftRate"
              value={shiftRate}
              onChange={(e) => setShiftRate(e.target.value)}
              className="w-full text-sm p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none font-bold text-primary"
            />
          </div>
        </div>

        {/* Уровень доступа в системе (Сотрудник vs Управляющий) */}
        <div className="mt-4 p-4 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-bold text-blue-950 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>Уровень доступа</span>
              </label>
              <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
                Выберите, какой интерфейс будет открываться данному пользователю
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setRole("employee")}
              className={`p-3 rounded-xl border text-left transition-all ${
                role === "employee"
                  ? "bg-white dark:bg-slate-800 border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                  : "bg-white/60 dark:bg-slate-850 border-gray-200 dark:border-slate-800 text-gray-500 opacity-70"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-gray-900 dark:text-white">
                <span>📱 Сотрудник</span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 mt-1">
                Доступ в мобильное PWA (отметки смен, чек-листы, калькуляции/продажи)
              </p>
            </button>

            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`p-3 rounded-xl border text-left transition-all ${
                role === "admin"
                  ? "bg-white dark:bg-slate-800 border-indigo-600 ring-2 ring-indigo-500/20 shadow-sm"
                  : "bg-white/60 dark:bg-slate-850 border-gray-200 dark:border-slate-800 text-gray-500 opacity-70"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-indigo-900 dark:text-indigo-300">
                <span>💻 Управляющий / Админ</span>
                <span className="text-[9px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded font-black">ДАШБОРД</span>
              </div>
              <p className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80 mt-1">
                Полный доступ к панели управления /admin (табель, финансы, сотрудники, журнал)
              </p>
            </button>
          </div>

          {role === "admin" && (
            <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/40 text-[11px] text-indigo-900 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-900/20 p-2.5 rounded-xl">
              💡 <b>Вход для управляющего:</b> Сможет войти на сайт по своему PIN-коду ({pinCode || "•••••"}) и сразу попадет в дашборд /admin.
            </div>
          )}
        </div>

        {/* Блок назначения Старшим / Руководителем */}
        <div className="mt-4 p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isLeadCheck"
              checked={isLead}
              onChange={(e) => setIsLead(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
            />
            <label htmlFor="isLeadCheck" className="text-xs font-bold text-amber-950 dark:text-amber-300 flex items-center gap-1 cursor-pointer">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>Назначить Старшим / Руководителем смены</span>
            </label>
          </div>

          {isLead && (
            <div className="pt-3 border-t border-amber-200/60 dark:border-amber-900/50 space-y-3">
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
                    Зона ответственности (Отдел)
                  </label>
                  <select
                    value={leadDepartment}
                    onChange={(e) => setLeadDepartment(e.target.value)}
                    className="w-full text-xs p-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-slate-700 rounded-xl font-bold text-gray-800 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="Кухня">🍳 Кухня (контроль поваров)</option>
                    <option value="Зал">🍽️ Зал (контроль официантов)</option>
                    <option value="Бар">☕ Бар (контроль барменов и бариста)</option>
                    <option value="Тех. персонал">🧹 Тех. персонал</option>
                    <option value="Все">🏢 Все сотрудники локации</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-amber-900 dark:text-amber-300">
                    Выберите подотчетных сотрудников:
                  </label>
                  <div className="max-h-40 overflow-y-auto bg-white dark:bg-slate-800 p-2 rounded-xl border border-amber-300 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
                    {allEmployees.map((sub) => {
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
        
        <div className="flex items-center space-x-2 pt-2">
          <input 
            type="checkbox" 
            id="isOvertimeEnabled" 
            name="isOvertimeEnabled" 
            defaultChecked 
            value="true"
            className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary" 
          />
          <label htmlFor="isOvertimeEnabled" className="text-xs font-medium text-gray-700 dark:text-slate-300 select-none">
            Начислять переработки (сверх базовых часов смены локации)
          </label>
        </div>
        
        <div className="flex justify-end pt-4 gap-3 border-t border-gray-100 dark:border-slate-800">
          <button 
            type="submit" 
            disabled={loading}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{loading ? "Создание..." : "Создать сотрудника"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
