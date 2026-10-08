"use client";

import { useEffect, useState } from "react";
import { 
  requestAdvance, 
  updateAdvanceStatus, 
  createDeduction, 
  deleteDeduction 
} from "@/app/actions/finances";
import { testIikoConnection, triggerIikoAttendanceSync, syncEmployeesFromIiko } from "@/app/actions/iiko";
import AdvanceStatementModal from "@/components/AdvanceStatementModal";
import { 
  Wallet, 
  TrendingUp, 
  Users, 
  Trash2, 
  Plus, 
  Calendar, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  Coins,
  FileText,
  Printer,
  ShieldAlert,
  XCircle,
  Check
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function AdminFinancePage() {
  const [activeTab, setActiveTab] = useState<"advances" | "deductions" | "iiko_sync">("advances");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [employees, setEmployees] = useState<any[]>([]);
  const [allAdvances, setAllAdvances] = useState<any[]>([]);
  const [allDeductions, setAllDeductions] = useState<any[]>([]);

  // iiko connection state
  const [iikoStatus, setIikoStatus] = useState<any>(null);
  const [iikoTesting, setIikoTesting] = useState(false);
  const [iikoSyncing, setIikoSyncing] = useState(false);

  // Advance Creation Modal
  const [showAddAdvance, setShowAddAdvance] = useState(false);
  const [selectedEmpForAdvance, setSelectedEmpForAdvance] = useState("");
  const [newAdvanceAmount, setNewAdvanceAmount] = useState("50000");
  const [newAdvanceReason, setNewAdvanceReason] = useState("");

  // Deduction Creation Modal
  const [showAddDeduction, setShowAddDeduction] = useState(false);
  const [selectedEmpForDeduction, setSelectedEmpForDeduction] = useState("");
  const [newDeductionAmount, setNewDeductionAmount] = useState("10000");
  const [newDeductionCategory, setNewDeductionCategory] = useState("Инвентаризация");
  const [newDeductionComment, setNewDeductionComment] = useState("");
  const [newDeductionDate, setNewDeductionDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Statement Printable Modal
  const [statementData, setStatementData] = useState<{
    isOpen: boolean;
    employeeName: string;
    position?: string;
    amount: number;
    reason?: string;
    date?: string;
  }>({
    isOpen: false,
    employeeName: "",
    position: "",
    amount: 0,
    reason: "",
    date: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      const { data: emps } = await supabase
        .from("profiles")
        .select("id, full_name, position, role, is_active, iiko_user_id")
        .eq("role", "employee")
        .order("full_name");

      if (emps) setEmployees(emps);

      const { data: advs } = await supabase
        .from("advances")
        .select("*, employee:profiles!employee_id(full_name, position)")
        .order("date", { ascending: false });

      if (advs) setAllAdvances(advs);

      const { data: deds } = await supabase
        .from("deductions")
        .select("*, employee:profiles!employee_id(full_name, position)")
        .order("date", { ascending: false });

      if (deds) setAllDeductions(deds);
    } catch (err: any) {
      console.error("Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTestIiko = async () => {
    setIikoTesting(true);
    try {
      const res = await testIikoConnection();
      setIikoStatus(res);
      if (res.success) {
        setNotification({ type: "success", text: `iiko подключен успешно! Найдено сотрудников: ${res.employeesFound}` });
      } else {
        setNotification({ type: "error", text: res.error || "Ошибка подключения к iiko" });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message });
    } finally {
      setIikoTesting(false);
    }
  };

  const handleSyncIikoStaff = async () => {
    setIikoSyncing(true);
    try {
      const res = await syncEmployeesFromIiko();
      if (res.success) {
        setNotification({ 
          type: "success", 
          text: `Синхронизация завершена: импортировано ${res.data?.importedCount}, обновлено ${res.data?.updatedCount}` 
        });
        loadData();
      } else {
        setNotification({ type: "error", text: res.error || "Ошибка импорта" });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message });
    } finally {
      setIikoSyncing(false);
    }
  };

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpForAdvance || !newAdvanceAmount) return;

    setSubmitting(true);
    try {
      const res = await requestAdvance({
        employeeId: selectedEmpForAdvance,
        amount: parseFloat(newAdvanceAmount),
        reason: newAdvanceReason,
      });

      if (res.success) {
        setNotification({ type: "success", text: "Аванс успешно добавлен" });
        setShowAddAdvance(false);
        setSelectedEmpForAdvance("");
        setNewAdvanceAmount("50000");
        setNewAdvanceReason("");
        loadData();
      } else {
        setNotification({ type: "error", text: res.error || "Ошибка создания аванса" });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: "approved" | "rejected" | "paid") => {
    try {
      const res = await updateAdvanceStatus(id, status);
      if (res.success) {
        setNotification({ type: "success", text: `Статус аванса обновлен на: ${status}` });
        loadData();
      } else {
        setNotification({ type: "error", text: res.error || "Ошибка обновления статуса" });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message });
    }
  };

  const handleCreateDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpForDeduction || !newDeductionAmount) return;

    setSubmitting(true);
    try {
      const res = await createDeduction({
        employeeId: selectedEmpForDeduction,
        amount: parseFloat(newDeductionAmount),
        category: newDeductionCategory,
        comment: newDeductionComment,
        date: newDeductionDate,
      });

      if (res.success) {
        setNotification({ type: "success", text: "Удержание успешно внесено" });
        setShowAddDeduction(false);
        setSelectedEmpForDeduction("");
        setNewDeductionAmount("10000");
        setNewDeductionComment("");
        loadData();
      } else {
        setNotification({ type: "error", text: res.error || "Ошибка сохранения" });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDeduction = async (id: string) => {
    if (!confirm("Удалить это удержание?")) return;
    try {
      const res = await deleteDeduction(id);
      if (res.success) {
        setNotification({ type: "success", text: "Удержание удалено" });
        loadData();
      } else {
        setNotification({ type: "error", text: res.error || "Ошибка удаления" });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message });
    }
  };

  const totalAdvancesPending = allAdvances
    .filter(a => a.status === "pending" || a.status === "approved")
    .reduce((acc, a) => acc + Number(a.amount || 0), 0);

  const totalDeductions = allDeductions.reduce((acc, d) => acc + Number(d.amount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Wallet className="w-7 h-7 text-primary" />
            <span>Финансы & iiko Интеграция</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Управление авансами, удержаниями (инвентаризация) и обмен данными с iiko
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 text-gray-500 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all"
            title="Обновить"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-sm font-medium animate-in fade-in duration-200 ${
          notification.type === "success" 
            ? "bg-green-50 text-green-800 border border-green-200" 
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === "success" ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
            <span>{notification.text}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Авансы к выплате</span>
            <Coins className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-gray-900">{totalAdvancesPending.toLocaleString("ru-RU")} ₸</div>
          <p className="text-xs text-gray-400 mt-1">{allAdvances.filter(a => a.status === "pending").length} заявок ожидают решения</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Удержания сотрудников</span>
            <ShieldAlert className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-3xl font-black text-red-600">{totalDeductions.toLocaleString("ru-RU")} ₸</div>
          <p className="text-xs text-gray-400 mt-1">Инвентаризация, недостачи, списания</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Статус iiko</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestIiko}
              disabled={iikoTesting}
              className="w-full bg-gray-50 hover:bg-gray-100 text-gray-900 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all border border-gray-200"
            >
              {iikoTesting ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <RefreshCw className="w-4 h-4 text-primary" />}
              <span>Проверить iiko</span>
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">API сервер: {process.env.NEXT_PUBLIC_SUPABASE_URL ? "готов к синхронизации" : "—"}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 p-1.5 rounded-2xl w-fit gap-1 text-sm font-bold">
        <button
          onClick={() => setActiveTab("advances")}
          className={`px-5 py-2 rounded-xl transition-all ${
            activeTab === "advances" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Авансы ({allAdvances.length})
        </button>
        <button
          onClick={() => setActiveTab("deductions")}
          className={`px-5 py-2 rounded-xl transition-all ${
            activeTab === "deductions" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Удержания / Инвентаризация ({allDeductions.length})
        </button>
        <button
          onClick={() => setActiveTab("iiko_sync")}
          className={`px-5 py-2 rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "iiko_sync" ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-primary"
          }`}
        >
          <span>iiko Синхронизация</span>
          <span className="bg-primary/10 text-primary text-[10px] font-black px-1.5 py-0.5 rounded-md">PRO</span>
        </button>
      </div>

      {/* TAB 1: ADVANCES */}
      {activeTab === "advances" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900">Заявления на аванс</h2>
            <button
              onClick={() => setShowAddAdvance(true)}
              className="bg-primary text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-sm hover:bg-primary/95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Выдать аванс</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
            {allAdvances.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Coins className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Нет заявлений на аванс</p>
              </div>
            ) : (
              allAdvances.map((adv) => (
                <div key={adv.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-gray-900 text-base">{adv.employee?.full_name || "Сотрудник"}</h4>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        adv.status === "paid" ? "bg-emerald-100 text-emerald-800" :
                        adv.status === "approved" ? "bg-blue-100 text-blue-800" :
                        adv.status === "rejected" ? "bg-red-100 text-red-800" :
                        "bg-amber-100 text-amber-800"
                      }`}>
                        {adv.status === "paid" ? "Выплачен" :
                         adv.status === "approved" ? "Согласован" :
                         adv.status === "rejected" ? "Отказан" : "На рассмотрении"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                      <span>Дата: {adv.date}</span>
                      <span>•</span>
                      <span>Причина: {adv.reason || "На личные нужды"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-gray-900 font-mono">
                      {Number(adv.amount).toLocaleString("ru-RU")} ₸
                    </span>

                    <button
                      onClick={() => setStatementData({
                        isOpen: true,
                        employeeName: adv.employee?.full_name || "Сотрудник",
                        position: adv.employee?.position || "Сотрудник",
                        amount: Number(adv.amount),
                        reason: adv.reason,
                        date: adv.date,
                      })}
                      className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                      title="Печать заявления"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    {adv.status === "pending" && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStatusChange(adv.id, "approved")}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all"
                        >
                          Одобрить
                        </button>
                        <button
                          onClick={() => handleStatusChange(adv.id, "rejected")}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition-all"
                        >
                          Отказать
                        </button>
                      </div>
                    )}

                    {adv.status === "approved" && (
                      <button
                        onClick={() => handleStatusChange(adv.id, "paid")}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Выдать</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DEDUCTIONS */}
      {activeTab === "deductions" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900">Удержания по инвентаризации и недостачам</h2>
            <button
              onClick={() => setShowAddDeduction(true)}
              className="bg-red-600 text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-sm hover:bg-red-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Внести удержание</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
            {allDeductions.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Нет внесенных удержаний</p>
              </div>
            ) : (
              allDeductions.map((ded) => (
                <div key={ded.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                  <div>
                    <h4 className="font-bold text-gray-900 text-base">{ded.employee?.full_name || "Сотрудник"}</h4>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                      <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">{ded.category || "Инвентаризация"}</span>
                      <span>•</span>
                      <span>Дата: {ded.date}</span>
                      {ded.comment && (
                        <>
                          <span>•</span>
                          <span>Комментарий: {ded.comment}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xl font-black text-red-600 font-mono">
                      -{Number(ded.amount).toLocaleString("ru-RU")} ₸
                    </span>

                    <button
                      onClick={() => handleDeleteDeduction(ded.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="Удалить удержание"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: IIKO SYNC */}
      {activeTab === "iiko_sync" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span>Синхронизация персонала и явок с iiko</span>
            </h3>
            <p className="text-sm text-gray-500">
              Позволяет автоматически подтянуть список поваров, сушистов и кассиров из номенклатуры iiko, а также выгружать подтвержденные явки.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-3">
                <h4 className="font-bold text-gray-900 text-sm">Импорт сотрудников из iiko</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Загружает активных сотрудников из базы iikoResto / Cloud, сопоставляет по номерам телефонов и PIN-кодам.
                </p>
                <button
                  onClick={handleSyncIikoStaff}
                  disabled={iikoSyncing}
                  className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
                >
                  {iikoSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>Синхронизировать сотрудников</span>
                </button>
              </div>

              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-3">
                <h4 className="font-bold text-gray-900 text-sm">Тест подключения к серверу iiko</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Проверяет авторизацию по логину/паролю/ключу API из .env.local и считывает список подразделений.
                </p>
                <button
                  onClick={handleTestIiko}
                  disabled={iikoTesting}
                  className="w-full bg-gray-900 hover:bg-black text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
                >
                  {iikoTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Проверить соединение</span>
                </button>
              </div>
            </div>

            {iikoStatus && (
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs font-mono">
                <pre>{JSON.stringify(iikoStatus, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add Advance */}
      {showAddAdvance && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Новый аванс сотруднику</h3>
            <form onSubmit={handleCreateAdvance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Сотрудник *</label>
                <select
                  required
                  value={selectedEmpForAdvance}
                  onChange={(e) => setSelectedEmpForAdvance(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-primary"
                >
                  <option value="">Выберите сотрудника...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.position || "Сотрудник"})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Сумма (₸) *</label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="500"
                  value={newAdvanceAmount}
                  onChange={(e) => setNewAdvanceAmount(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Причина / Примечание</label>
                <input
                  type="text"
                  placeholder="На личные нужды"
                  value={newAdvanceReason}
                  onChange={(e) => setNewAdvanceReason(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAdvance(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50"
                >
                  {submitting ? "Сохранение..." : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Deduction */}
      {showAddDeduction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Внести удержание</h3>
            <form onSubmit={handleCreateDeduction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Сотрудник *</label>
                <select
                  required
                  value={selectedEmpForDeduction}
                  onChange={(e) => setSelectedEmpForDeduction(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-primary"
                >
                  <option value="">Выберите сотрудника...</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.position || "Сотрудник"})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Сумма (₸) *</label>
                  <input
                    type="number"
                    required
                    min="100"
                    step="100"
                    value={newDeductionAmount}
                    onChange={(e) => setNewDeductionAmount(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Категория</label>
                  <select
                    value={newDeductionCategory}
                    onChange={(e) => setNewDeductionCategory(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-primary"
                  >
                    <option value="Инвентаризация">Инвентаризация</option>
                    <option value="Недостача">Недостача</option>
                    <option value="Списание / Брак">Списание / Брак</option>
                    <option value="Прочее">Прочее</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Дата</label>
                <input
                  type="date"
                  value={newDeductionDate}
                  onChange={(e) => setNewDeductionDate(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Комментарий</label>
                <input
                  type="text"
                  placeholder="Причина удержания..."
                  value={newDeductionComment}
                  onChange={(e) => setNewDeductionComment(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDeduction(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50"
                >
                  {submitting ? "Сохранение..." : "Внести"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Statement Printout */}
      <AdvanceStatementModal
        isOpen={statementData.isOpen}
        onClose={() => setStatementData(prev => ({ ...prev, isOpen: false }))}
        employeeName={statementData.employeeName}
        position={statementData.position}
        amount={statementData.amount}
        reason={statementData.reason}
        date={statementData.date}
      />
    </div>
  );
}
