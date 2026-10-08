"use client";

import { useEffect, useState } from "react";
import { getCurrentProfile } from "@/app/actions/auth";
import { requestAdvance, getEmployeeFinances } from "@/app/actions/finances";
import AdvanceStatementModal from "@/components/AdvanceStatementModal";
import { 
  Wallet, 
  Plus, 
  Coins, 
  Printer, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle,
  Loader2
} from "lucide-react";
import { formatDisplayName } from "@/utils/formatters";

export default function FinancePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const [advances, setAdvances] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);

  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState("50000");
  const [advanceReason, setAdvanceReason] = useState("На личные нужды");
  const [submittingAdvance, setSubmittingAdvance] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  const [statementData, setStatementData] = useState<{
    isOpen: boolean;
    amount: number;
    reason?: string;
    date?: string;
  }>({
    isOpen: false,
    amount: 0,
    reason: "",
    date: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const p = await getCurrentProfile();
      if (p) {
        setProfile(p);
        const finRes = await getEmployeeFinances(p.id);
        if (finRes.success) {
          setAdvances(finRes.advances);
          setDeductions(finRes.deductions);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRequestAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSubmittingAdvance(true);
    setAdvanceError(null);

    try {
      const res = await requestAdvance({
        employeeId: profile.id,
        amount: parseFloat(advanceAmount),
        reason: advanceReason,
      });

      if (res.success) {
        setShowAdvanceModal(false);
        loadData();
      } else {
        setAdvanceError(res.error || "Ошибка запроса аванса");
      }
    } catch (err: any) {
      setAdvanceError(err.message || "Ошибка сети");
    } finally {
      setSubmittingAdvance(false);
    }
  };

  const totalAdvances = advances
    .filter(a => a.status === "paid" || a.status === "approved")
    .reduce((acc, a) => acc + Number(a.amount || 0), 0);

  const totalDeductions = deductions.reduce((acc, d) => acc + Number(d.amount || 0), 0);

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6 pb-28">
      {/* Шапка */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Мои финансы</h1>
              <p className="text-xs text-slate-500">{formatDisplayName(profile?.full_name)}</p>
            </div>
          </div>

          <button
            onClick={() => setShowAdvanceModal(true)}
            className="px-3.5 py-2 bg-primary text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Запросить аванс</span>
          </button>
        </div>
      </div>

      {/* Итоги */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Авансы за месяц
          </span>
          <div className="text-2xl font-black text-amber-600 font-mono">
            {totalAdvances.toLocaleString("ru-RU")} ₸
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Удержания
          </span>
          <div className="text-2xl font-black text-red-600 font-mono">
            -{totalDeductions.toLocaleString("ru-RU")} ₸
          </div>
        </div>
      </div>

      {/* Список авансов */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
          Заявления на аванс ({advances.length})
        </h3>

        {advances.length === 0 ? (
          <div className="bg-white rounded-3xl p-6 text-center border border-slate-200 text-xs text-slate-400">
            Нет активных заявлений
          </div>
        ) : (
          advances.map(a => (
            <div key={a.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black font-mono text-slate-900">
                    {Number(a.amount).toLocaleString("ru-RU")} ₸
                  </span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    a.status === "paid" ? "bg-emerald-100 text-emerald-800" :
                    a.status === "approved" ? "bg-blue-100 text-blue-800" :
                    a.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {a.status === "paid" ? "Выплачен" : a.status === "approved" ? "Одобрен" : a.status === "rejected" ? "Отказан" : "На рассмотрении"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{a.date} • {a.reason}</p>
              </div>

              <button
                onClick={() => setStatementData({
                  isOpen: true,
                  amount: Number(a.amount),
                  reason: a.reason,
                  date: a.date,
                })}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
                title="Печать заявления"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Список удержаний */}
      {deductions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
            Удержания ({deductions.length})
          </h3>

          {deductions.map(d => (
            <div key={d.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                  {d.category || "Инвентаризация"}
                </span>
                <p className="text-[11px] text-slate-500 mt-1">{d.date} {d.comment ? `• ${d.comment}` : ""}</p>
              </div>
              <span className="text-sm font-black font-mono text-red-600">
                -{Number(d.amount).toLocaleString("ru-RU")} ₸
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Request Advance */}
      {showAdvanceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Запрос аванса</h3>

            {advanceError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{advanceError}</span>
              </div>
            )}

            <form onSubmit={handleRequestAdvance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Сумма аванса (₸) *
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="500"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Причина
                </label>
                <input
                  type="text"
                  value={advanceReason}
                  onChange={(e) => setAdvanceReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submittingAdvance}
                  className="flex-1 py-3 bg-primary text-white font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {submittingAdvance ? "Отправка..." : "Отправить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Printable Statement */}
      <AdvanceStatementModal
        isOpen={statementData.isOpen}
        onClose={() => setStatementData(prev => ({ ...prev, isOpen: false }))}
        employeeName={profile?.full_name || "Сотрудник"}
        position={profile?.position || "Сотрудник"}
        amount={statementData.amount}
        reason={statementData.reason}
        date={statementData.date}
      />
    </div>
  );
}
