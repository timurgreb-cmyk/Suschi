"use client";

import { useState } from "react";
import LocalTime from "@/components/LocalTime";
import { processOvertimeApproval, processLateFineApproval } from "@/app/actions/timesheet";

export default function TimesheetRow({ row }: { row: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customFines, setCustomFines] = useState<Record<string, string>>({});
  const [editingFineDay, setEditingFineDay] = useState<string | null>(null);

  const handleApprove = async (e: React.MouseEvent, detail: any) => {
    e.stopPropagation();
    setLoading(true);
    await processOvertimeApproval(row.id, detail.day, detail.calculatedOvertime, detail.calculatedOvertime, 'approved');
    setLoading(false);
  };

  const handleReject = async (e: React.MouseEvent, detail: any) => {
    e.stopPropagation();
    setLoading(true);
    await processOvertimeApproval(row.id, detail.day, detail.calculatedOvertime, 0, 'rejected');
    setLoading(false);
  };

  const handleApproveFine = async (e: React.MouseEvent, detail: any, customAmount?: number) => {
    e.stopPropagation();
    setLoading(true);
    const finalAmount = customAmount !== undefined ? customAmount : detail.calculatedFine;
    await processLateFineApproval(row.id, detail.day, detail.calculatedFine, finalAmount, 'approved');
    setEditingFineDay(null);
    setLoading(false);
  };

  const handleRejectFine = async (e: React.MouseEvent, detail: any) => {
    e.stopPropagation();
    setLoading(true);
    await processLateFineApproval(row.id, detail.day, detail.calculatedFine, 0, 'rejected');
    setLoading(false);
  };

  const handleResetFine = async (e: React.MouseEvent, detail: any) => {
    e.stopPropagation();
    setLoading(true);
    await processLateFineApproval(row.id, detail.day, detail.calculatedFine, detail.calculatedFine, 'pending');
    setLoading(false);
  };

  return (
    <>
      <tr 
        onClick={() => setIsExpanded(!isExpanded)} 
        className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50/30' : ''} ${row.missingCheckouts > 0 ? "bg-red-50/50" : ""}`}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <div className="text-sm font-medium text-gray-900">{row.full_name}</div>
            <svg className={`w-4 h-4 ml-2 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="19 9l-7 7-7-7" />
            </svg>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
          {row.completedShifts} дн.
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">
          {row.totalWorkedHours ? row.totalWorkedHours.toFixed(1) : "0.0"} ч
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {row.shift_rate ? `${row.shift_rate} ₸` : "Не задана"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-medium">
          {row.overtimeHours > 0 ? `+${row.overtimeHours} ч` : "—"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
          {row.totalFines > 0 ? `-${row.totalFines} ₸` : "—"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          {row.missingCheckouts > 0 ? (
            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
              {row.missingCheckouts} смен(ы)
            </span>
          ) : (
            <span className="text-sm text-gray-400">—</span>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-primary">
          {row.totalEarned} ₸
        </td>
      </tr>
      
      {isExpanded && (
        <tr className="bg-gray-50/50">
          <td colSpan={8} className="px-6 py-4">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-3 px-2">Детализация по дням:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {row.dailyDetails.map((detail: any) => (
                <div key={detail.day} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <span suppressHydrationWarning className="font-bold text-gray-700">{detail.formattedDay}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      detail.status === 'complete' ? 'bg-green-100 text-green-700' : 
                      detail.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {detail.status === 'complete' ? 'Отработано' : detail.status === 'in_progress' ? 'В процессе' : 'Ошибка'}
                    </span>
                  </div>

                  {/* Опоздание и штраф с ручным подтверждением */}
                  {detail.isLate && detail.calculatedFine > 0 && (
                    <div className="bg-red-50 text-red-800 text-[11px] p-2.5 rounded-md mb-2 flex flex-col gap-2 font-medium border border-red-100 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span>⏰ Опоздание: {detail.lateMinutes} мин.</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          detail.fineApprovalStatus === 'approved' ? 'bg-green-200 text-green-800' :
                          detail.fineApprovalStatus === 'rejected' ? 'bg-gray-200 text-gray-800' : 'bg-yellow-200 text-yellow-800'
                        }`}>
                          {detail.fineApprovalStatus === 'approved' ? `Подтвержден (${detail.fineAmount} ₸)` :
                           detail.fineApprovalStatus === 'rejected' ? 'Списан (0 ₸)' : 'Ожидает решения'}
                        </span>
                      </div>
                      
                      {editingFineDay === detail.day ? (
                        <div className="flex gap-1.5 items-center mt-1">
                          <input
                            type="number"
                            value={customFines[detail.day] !== undefined ? customFines[detail.day] : detail.fineAmount}
                            onChange={(e) => setCustomFines({ ...customFines, [detail.day]: e.target.value })}
                            className="w-20 p-1 border border-red-200 rounded text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-red-400"
                            placeholder="Сумма"
                          />
                          <button
                            onClick={(e) => handleApproveFine(e, detail, parseInt(customFines[detail.day]) || 0)}
                            disabled={loading}
                            className="bg-green-600 text-white px-2 py-1 rounded text-[10px] hover:bg-green-700 transition-colors font-bold disabled:opacity-50"
                          >
                            Сохранить
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingFineDay(null); }}
                            className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-[10px] hover:bg-gray-300 transition-colors font-bold"
                          >
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center border-t border-red-100/50 pt-1.5 mt-1">
                          <span className="text-[10px] text-red-700">
                            Расчетный: <span className="font-bold">{detail.calculatedFine} ₸</span>
                          </span>
                          
                          {detail.fineApprovalStatus === 'pending' && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={(e) => handleApproveFine(e, detail)}
                                disabled={loading}
                                className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded text-[10px] font-bold transition-colors disabled:opacity-50"
                              >
                                Ок
                              </button>
                              <button
                                onClick={(e) => handleRejectFine(e, detail)}
                                disabled={loading}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-0.5 rounded text-[10px] font-bold transition-colors disabled:opacity-50"
                              >
                                Списать
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingFineDay(detail.day); }}
                                className="text-blue-700 hover:underline text-[10px] font-semibold"
                              >
                                Изменить
                              </button>
                            </div>
                          )}

                          {detail.fineApprovalStatus !== 'pending' && (
                            <button
                              onClick={(e) => handleResetFine(e, detail)}
                              disabled={loading}
                              className="text-gray-500 hover:text-gray-700 hover:underline text-[10px] font-medium"
                            >
                              Сбросить решение
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Опоздание в пределах нормы */}
                  {detail.isLate && detail.calculatedFine === 0 && (
                    <div className="bg-gray-50 text-gray-600 text-[11px] p-2 rounded-md mb-2 flex justify-between items-center font-medium border border-gray-100 shadow-sm">
                      <span>⏰ Опоздание: {detail.lateMinutes} мин.</span>
                      <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full font-bold">В пределах нормы</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm mb-1">
                    <div className="text-gray-500">Приход: <span className="text-gray-900 font-medium">{detail.firstIn ? <LocalTime isoString={detail.firstIn} formatStr="HH:mm" /> : "—"}</span></div>
                    <div className="text-gray-500">Уход: <span className="text-gray-900 font-medium">{detail.lastOut ? <LocalTime isoString={detail.lastOut} formatStr="HH:mm" /> : "—"}</span></div>
                  </div>
                  {detail.status === 'complete' && (
                    <div className="flex flex-col text-xs mt-2 pt-2 border-t border-gray-100 gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Отработано: <span className="font-medium text-gray-700">{detail.actualHours.toFixed(1)} ч.</span></span>
                        
                        {detail.calculatedOvertime > 0 && !detail.requiresApproval && (
                          <span className="text-orange-600 font-medium">+ {detail.calculatedOvertime} ч. переработки</span>
                        )}
                        
                        {detail.requiresApproval && detail.approvalStatus === 'approved' && (
                          <span className="text-green-600 font-medium">+ {detail.overtime} ч. (одобрено)</span>
                        )}
                        
                        {detail.requiresApproval && detail.approvalStatus === 'rejected' && (
                          <span className="text-red-500 font-medium line-through">{detail.calculatedOvertime} ч. откл.</span>
                        )}
                      </div>
                      
                      {detail.requiresApproval && detail.approvalStatus === 'pending' && (
                        <div className="flex flex-col bg-orange-50 p-2 rounded border border-orange-200 mt-1">
                          <span className="text-orange-800 font-medium mb-2">Переработка {detail.calculatedOvertime} ч. требует проверки</span>
                          <div className="flex gap-2">
                            <button 
                              onClick={(e) => handleApprove(e, detail)} 
                              disabled={loading}
                              className="flex-1 bg-green-500 text-white px-2 py-1.5 rounded text-[11px] font-bold hover:bg-green-600 transition-colors disabled:opacity-50"
                            >
                              Одобрить
                            </button>
                            <button 
                              onClick={(e) => handleReject(e, detail)} 
                              disabled={loading}
                              className="flex-1 bg-red-500 text-white px-2 py-1.5 rounded text-[11px] font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                              Отклонить
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
