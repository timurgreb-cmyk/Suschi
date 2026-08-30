"use client";

import { useState } from "react";
import { processLateFineApproval, resetMonthLateFines } from "@/app/actions/timesheet";
import { AlertCircle, Check, X, Edit2, Search, Calendar, Landmark, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function FinesListClient({
  fines,
  monthStr,
}: {
  fines: any[];
  monthStr: string;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customFineVal, setCustomFineVal] = useState("");
  const [resetting, setResetting] = useState(false);

  const handleResetAll = async () => {
    if (
      !confirm(
        "ВНИМАНИЕ! Вы собираетесь сбросить ВСЕ решения по штрафам за выбранный месяц.\n\nВсе штрафы вернутся в статус «Ожидает решения». Продолжить?"
      )
    ) {
      return;
    }

    setResetting(true);
    const result = await resetMonthLateFines(monthStr);
    if (result.error) {
      alert("Ошибка: " + result.error);
    } else {
      router.refresh();
      alert("Решения по штрафам за этот месяц успешно сброшены.");
    }
    setResetting(false);
  };

  const handleAction = async (employeeId: string, day: string, calculated: number, approved: number, status: 'approved' | 'rejected' | 'pending') => {
    const idKey = `${employeeId}_${day}`;
    setLoadingId(idKey);
    const res = await processLateFineApproval(employeeId, day, calculated, approved, status);
    setLoadingId(null);
    setEditingId(null);
    if (res?.success) {
      router.refresh();
    } else {
      alert("Ошибка: " + (res?.error || "Неизвестная ошибка"));
    }
  };

  // Filter fines
  const filteredFines = fines.filter(f => {
    const matchesSearch = f.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = 
      statusFilter === "all" ? true :
      statusFilter === "pending" ? f.approvalStatus === "pending" :
      statusFilter === "approved" ? f.approvalStatus === "approved" :
      f.approvalStatus === "rejected";
    return matchesSearch && matchesStatus;
  });

  // Calculations for summary cards
  const totalApproved = fines.reduce((acc, f) => acc + (f.approvalStatus === 'approved' ? f.fineAmount : 0), 0);
  const pendingCount = fines.filter(f => f.approvalStatus === 'pending').length;
  const pendingAmount = fines.reduce((acc, f) => acc + (f.approvalStatus === 'pending' ? f.calculatedFine : 0), 0);
  const totalCalculated = fines.reduce((acc, f) => acc + f.calculatedFine, 0);

  return (
    <div>
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Всего одобрено</h3>
            <p className="text-3xl font-black text-primary">{totalApproved.toLocaleString()} ₸</p>
            <p className="text-xs text-gray-400 mt-1">Сумма удержанных штрафов</p>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
            <Landmark className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Ожидает решения</h3>
            <p className="text-3xl font-black text-yellow-600">{pendingAmount.toLocaleString()} ₸</p>
            <p className="text-xs text-yellow-600 font-bold mt-1">{pendingCount} шт. требует проверки</p>
          </div>
          <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center text-yellow-600">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Сумма нарушений</h3>
            <p className="text-3xl font-black text-gray-800">{totalCalculated.toLocaleString()} ₸</p>
            <p className="text-xs text-gray-400 mt-1">Всего опозданий за период: {fines.length}</p>
          </div>
          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-gray-600">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск сотрудника..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-900"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="flex gap-1.5 w-full sm:w-auto">
            {(["all", "pending", "approved", "rejected"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  statusFilter === filter
                    ? "bg-primary border-primary text-white shadow-sm"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {filter === "all" ? "Все" :
                 filter === "pending" ? "Ожидают" :
                 filter === "approved" ? "Подтверждены" : "Списаны"}
              </button>
            ))}
          </div>

          <button
            onClick={handleResetAll}
            disabled={resetting}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border border-red-200 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 disabled:opacity-50 transition-all shadow-sm whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {resetting ? "Сброс..." : "Сбросить решения"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100">
          {filteredFines.map((fine) => {
            const idKey = `${fine.employeeId}_${fine.day}`;
            const isLoading = loadingId === idKey;
            const isEditing = editingId === idKey;

            return (
              <div key={idKey} className="p-5 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50/50 transition-colors gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    fine.approvalStatus === 'approved' ? 'bg-green-50 text-green-600' :
                    fine.approvalStatus === 'rejected' ? 'bg-gray-50 text-gray-500' : 'bg-yellow-50 text-yellow-600'
                  }`}>
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-900 text-base">{fine.employeeName}</h4>
                      {(fine.isCashier || fine.planStart === "10:45") && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          💰 Кассир (10:45)
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                      <span className="font-semibold text-gray-700 capitalize">{fine.formattedDay}</span>
                      <span>•</span>
                      <span>📍 {fine.locationName}</span>
                      <span>•</span>
                      <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded font-medium">⏰ Опоздание: {fine.lateMinutes} мин</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      Время прихода: <span className="text-gray-900 font-bold">{fine.formattedFirstIn}</span> (план: {fine.planStart})
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:items-center gap-4 sm:gap-6 self-end md:self-auto w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-gray-50 pt-3 pt-0">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Сумма штрафа</p>
                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          value={customFineVal}
                          onChange={(e) => setCustomFineVal(e.target.value)}
                          className="w-24 p-1.5 border border-red-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400/20"
                          placeholder="Сумма"
                        />
                        <button
                          onClick={() => handleAction(fine.employeeId, fine.day, fine.calculatedFine, parseInt(customFineVal) || 0, 'approved')}
                          disabled={isLoading}
                          className="bg-green-600 text-white p-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="bg-gray-100 text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className={`text-xl font-extrabold ${
                          fine.approvalStatus === 'approved' ? 'text-red-600' :
                          fine.approvalStatus === 'rejected' ? 'text-gray-400 line-through' : 'text-yellow-600'
                        }`}>
                          {fine.approvalStatus === 'approved' ? `${fine.fineAmount} ₸` :
                           fine.approvalStatus === 'rejected' ? '0 ₸' : `${fine.calculatedFine} ₸`}
                        </span>
                        {fine.approvalStatus === 'approved' && fine.fineAmount !== fine.calculatedFine && (
                          <span className="text-xs text-gray-400 line-through flex">({fine.calculatedFine} ₸)</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {fine.approvalStatus === 'pending' && !isEditing && (
                      <>
                        <button
                          onClick={() => handleAction(fine.employeeId, fine.day, fine.calculatedFine, fine.calculatedFine, 'approved')}
                          disabled={isLoading}
                          className="flex-1 sm:flex-initial bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-sm"
                        >
                          Одобрить
                        </button>
                        <button
                          onClick={() => handleAction(fine.employeeId, fine.day, fine.calculatedFine, 0, 'rejected')}
                          disabled={isLoading}
                          className="flex-1 sm:flex-initial bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                        >
                          Списать
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(idKey);
                            setCustomFineVal(String(fine.fineAmount || fine.calculatedFine));
                          }}
                          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 p-2.5 rounded-xl transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {fine.approvalStatus !== 'pending' && (
                      <button
                        onClick={() => handleAction(fine.employeeId, fine.day, fine.calculatedFine, fine.calculatedFine, 'pending')}
                        disabled={isLoading}
                        className="w-full sm:w-auto bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      >
                        Сбросить решение
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredFines.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">Штрафов не найдено</p>
              <p className="text-xs text-gray-400 mt-1">Попробуйте изменить фильтр или поисковый запрос</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
