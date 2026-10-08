"use client";

import { useState } from "react";
import { Download, Calendar, Wallet, Sparkles, Clock, Coins, ChevronDown, ChevronRight } from "lucide-react";
import SendTelegramReportButton from "@/components/admin/SendTelegramReportButton";

export interface TimesheetDayInfo {
  dateStr: string;   // "2026-09-01"
  dayNum: number;    // 1
  label: string;     // "01.09"
  dayOfWeek: string; // "Вт"
  isWeekend: boolean;
}

interface Props {
  employees: any[];
  days: TimesheetDayInfo[];
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  matrixData: Record<string, {
    totalMinutes: number;
    days: Record<string, { minutes: number; inTime?: string; outTime?: string; status?: string; waiterTip?: number }>;
    basePay?: number;
    waiterBonus?: number;
    advances: number;
    deductions: number;
    penalties: number;
    earned: number;
    netPay: number;
  }>;
  departments: string[];
}

function formatMinutesToHours(minutes: number): string {
  if (!minutes || minutes <= 0) return "00ч 00мин";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}ч ${String(m).padStart(2, "0")}мин`;
}

export default function MonthlyTimesheetMatrix({
  employees,
  days,
  periodLabel,
  dateFrom,
  dateTo,
  matrixData,
  departments,
}: Props) {
  const [selectedDept, setSelectedDept] = useState("Все");

  // Group employees by department
  const groupedEmployees: Record<string, any[]> = {};
  employees.forEach((emp) => {
    const dept = emp.department || "Кухня";
    if (!groupedEmployees[dept]) groupedEmployees[dept] = [];
    groupedEmployees[dept].push(emp);
  });

  const activeDepartments = selectedDept === "Все" 
    ? Object.keys(groupedEmployees) 
    : [selectedDept];

  // Подсчет общих KPI по видимым сотрудникам
  let totalBasePaySum = 0;
  let totalWaiterBonusSum = 0;
  let totalEarnedSum = 0;
  let totalNetPaySum = 0;
  let totalMinutesSum = 0;

  activeDepartments.forEach((dept) => {
    const emps = groupedEmployees[dept] || [];
    emps.forEach((emp) => {
      const stats = matrixData[emp.id];
      if (stats) {
        totalBasePaySum += stats.basePay || 0;
        totalWaiterBonusSum += stats.waiterBonus || 0;
        totalEarnedSum += stats.earned || 0;
        totalNetPaySum += stats.netPay || 0;
        totalMinutesSum += stats.totalMinutes || 0;
      }
    });
  });

  // Export to CSV/Excel (с поддержкой кириллицы UTF-8 с BOM)
  const exportToExcel = () => {
    let tableHTML = `
      <html xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; font-family: sans-serif; }
          th, td { border: 1px solid #333; padding: 4px; font-size: 12px; }
          th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Сотрудник</th>
              <th>Должность</th>
              <th>Отдел</th>
              <th>Всего отработано</th>
              <th>Оклад (₸)</th>
              <th>% Официанта (₸)</th>
              <th>Итого начислено (₸)</th>
              <th>Авансы (₸)</th>
              <th>Удержания (₸)</th>
              <th>Штрафы (₸)</th>
              <th>К выплате (₸)</th>
`;
    days.forEach((d) => {
      tableHTML += `<th>${d.label} (${d.dayOfWeek})</th>`;
    });
    tableHTML += `</tr></thead><tbody>`;

    let globalIndex = 1;
    Object.entries(groupedEmployees).forEach(([dept, emps]) => {
      // Group header
      tableHTML += `<tr><td colspan="${12 + days.length}" style="background-color: #e2efda; font-weight: bold; text-align: center;">-- ${dept} --</td></tr>`;

      emps.forEach((emp) => {
        const stats = matrixData[emp.id] || {
          totalMinutes: 0,
          days: {},
          basePay: 0,
          waiterBonus: 0,
          advances: 0,
          deductions: 0,
          penalties: 0,
          earned: 0,
          netPay: 0,
        };

        // Зеленый (работал), Оранжевый (не работал)
        const rowBg = stats.totalMinutes > 0 || (stats.waiterBonus && stats.waiterBonus > 0) ? "#a9d08e" : "#f4b084";

        tableHTML += `<tr style="background-color: ${rowBg};">`;
        tableHTML += `<td>${globalIndex++}</td>`;
        tableHTML += `<td>${emp.full_name}</td>`;
        tableHTML += `<td>${emp.position || "Сотрудник"}</td>`;
        tableHTML += `<td>${dept}</td>`;
        tableHTML += `<td>${formatMinutesToHours(stats.totalMinutes)}</td>`;
        tableHTML += `<td>${stats.basePay ?? 0}</td>`;
        tableHTML += `<td>${stats.waiterBonus ?? 0}</td>`;
        tableHTML += `<td>${stats.earned}</td>`;
        tableHTML += `<td>${stats.advances}</td>`;
        tableHTML += `<td>${stats.deductions}</td>`;
        tableHTML += `<td>${stats.penalties}</td>`;
        tableHTML += `<td>${stats.netPay}</td>`;

        days.forEach((d) => {
          const dayData = stats.days[d.dateStr];
          if (dayData && (dayData.minutes > 0 || (dayData.waiterTip || 0) > 0)) {
            let val = dayData.minutes > 0 ? formatMinutesToHours(dayData.minutes) : "00ч 00мин";
            if (dayData.waiterTip && dayData.waiterTip > 0) {
              val += ` (+${dayData.waiterTip} ₸)`;
            }
            tableHTML += `<td>${val}</td>`;
          } else {
            tableHTML += `<td>00ч 00мин</td>`;
          }
        });
        tableHTML += `</tr>`;
      });
    });

    tableHTML += `</tbody></table></body></html>`;

    const blob = new Blob([tableHTML], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const filename = dateFrom === dateTo 
      ? `Табель_${dateFrom}.xls` 
      : `Табель_с_${dateFrom}_по_${dateTo}.xls`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Панель действий */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-gray-200 shadow-sm print:hidden">
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">
            Табель учета рабочего времени — {periodLabel}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Сводный табель со ставками оклада, процентами официантов из iiko и расчетами за выбранный период
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Фильтр отделов */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="text-xs font-bold bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl focus:outline-none text-gray-800"
          >
            <option value="Все">Все отделы</option>
            {Object.keys(groupedEmployees).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <SendTelegramReportButton />

          <button
            onClick={exportToExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>📥 Скачать Табель (Excel)</span>
          </button>
        </div>
      </div>

      {/* KPI карточки */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold mb-1">
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span>К выплате (ФОТ)</span>
          </div>
          <p className="text-lg font-black text-gray-900 font-mono">
            {new Intl.NumberFormat("ru-RU").format(totalNetPaySum)} ₸
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold mb-1">
            <Coins className="w-4 h-4 text-blue-600" />
            <span>Оклады по сменам</span>
          </div>
          <p className="text-lg font-black text-gray-900 font-mono">
            {new Intl.NumberFormat("ru-RU").format(totalBasePaySum)} ₸
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold mb-1">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>% Официантов (iiko)</span>
          </div>
          <p className="text-lg font-black text-emerald-700 font-mono">
            +{new Intl.NumberFormat("ru-RU").format(totalWaiterBonusSum)} ₸
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold mb-1">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Часы работы</span>
          </div>
          <p className="text-lg font-black text-gray-900 font-mono">
            {formatMinutesToHours(totalMinutesSum)}
          </p>
        </div>
      </div>

      {/* Таблица Табеля (Матрица по выбранным дням периода) */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="min-w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 font-bold text-gray-800 uppercase tracking-wider text-left">
              <th className="p-3 sticky left-0 bg-white z-20 min-w-[170px] shadow-sm">Сотрудник</th>
              <th className="p-3 min-w-[110px]">Должность</th>
              <th className="p-3 min-w-[95px]">Отдел</th>
              <th className="p-3 min-w-[85px] bg-amber-50/80 font-black text-amber-950">Часы</th>
              <th className="p-3 min-w-[95px] text-gray-700">Оклад</th>
              <th className="p-3 min-w-[110px] bg-emerald-50/90 font-black text-emerald-900">% Официанта</th>
              <th className="p-3 min-w-[105px] bg-blue-50/80 font-black text-blue-900">Начислено</th>
              <th className="p-3 min-w-[85px] text-indigo-700">Авансы</th>
              <th className="p-3 min-w-[85px] text-amber-700">Удержания</th>
              <th className="p-3 min-w-[85px] text-red-700">Штрафы</th>
              <th className="p-3 min-w-[110px] bg-green-50/80 font-black text-green-900 text-right">К выплате</th>
              
              {/* Колонки дней периода */}
              {days.map((d) => (
                <th 
                  key={d.dateStr} 
                  className={`p-2 text-center min-w-[65px] border-l border-gray-100 font-mono text-[10px] ${
                    d.isWeekend ? "bg-rose-50/70 text-rose-700 font-bold" : "text-gray-600"
                  }`}
                >
                  <div className="font-bold">{d.label}</div>
                  <div className={`text-[9px] ${d.isWeekend ? "text-rose-500 font-black" : "text-gray-400 font-normal"}`}>
                    {d.dayOfWeek}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {activeDepartments.map((dept) => {
              const deptEmps = groupedEmployees[dept] || [];
              if (deptEmps.length === 0) return null;

              return (
                <div key={dept} className="contents">
                  {/* Заголовок Отдела */}
                  <tr className="bg-orange-500/20 font-black text-orange-950 text-xs">
                    <td colSpan={days.length + 11} className="p-2.5 px-4 sticky left-0">
                      📂 {dept}
                    </td>
                  </tr>

                  {deptEmps.map((emp) => {
                    const stats = matrixData[emp.id] || {
                      totalMinutes: 0,
                      days: {},
                      basePay: 0,
                      waiterBonus: 0,
                      advances: 0,
                      deductions: 0,
                      penalties: 0,
                      earned: 0,
                      netPay: 0,
                    };

                    return (
                      <tr key={emp.id} className="hover:bg-gray-50/80 transition-colors">
                        {/* ФИО */}
                        <td className="p-3 font-bold text-gray-900 sticky left-0 bg-white shadow-sm z-10 whitespace-nowrap">
                          {emp.full_name}
                        </td>
                        <td className="p-3 text-gray-600 whitespace-nowrap">
                          {emp.position || "—"}
                        </td>
                        <td className="p-3 text-gray-500 whitespace-nowrap">
                          {dept}
                        </td>
                        
                        {/* Суммарно отработано */}
                        <td className="p-3 font-bold text-gray-950 bg-amber-50/50 whitespace-nowrap font-mono">
                          {formatMinutesToHours(stats.totalMinutes)}
                        </td>

                        {/* Оклад */}
                        <td className="p-3 font-semibold text-gray-800 whitespace-nowrap font-mono">
                          {(stats.basePay ?? 0) > 0 
                            ? `${new Intl.NumberFormat("ru-RU").format(stats.basePay!)} ₸` 
                            : "0 ₸"}
                        </td>

                        {/* % Официанта */}
                        <td className="p-3 whitespace-nowrap font-mono bg-emerald-50/20">
                          {(stats.waiterBonus ?? 0) > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                              +{new Intl.NumberFormat("ru-RU").format(stats.waiterBonus!)} ₸
                            </span>
                          ) : (
                            <span className="text-gray-300 font-mono">—</span>
                          )}
                        </td>

                        {/* Начислено (Оклад + %) */}
                        <td className="p-3 font-black text-blue-950 bg-blue-50/30 whitespace-nowrap font-mono">
                          {stats.earned > 0 
                            ? `${new Intl.NumberFormat("ru-RU").format(stats.earned)} ₸` 
                            : "0 ₸"}
                        </td>

                        {/* Авансы */}
                        <td className="p-3 font-semibold text-indigo-700 whitespace-nowrap font-mono">
                          {stats.advances > 0 ? `-${new Intl.NumberFormat("ru-RU").format(stats.advances)}` : "—"}
                        </td>

                        {/* Удержания */}
                        <td className="p-3 font-semibold text-amber-700 whitespace-nowrap font-mono">
                          {stats.deductions > 0 ? `-${new Intl.NumberFormat("ru-RU").format(stats.deductions)}` : "—"}
                        </td>

                        {/* Штрафы */}
                        <td className="p-3 font-semibold text-red-600 whitespace-nowrap font-mono">
                          {stats.penalties > 0 ? `-${new Intl.NumberFormat("ru-RU").format(stats.penalties)}` : "—"}
                        </td>

                        {/* Итого к выплате */}
                        <td className="p-3 font-black text-green-700 bg-green-50/40 text-right whitespace-nowrap font-mono text-xs">
                          {new Intl.NumberFormat("ru-RU").format(stats.netPay)} ₸
                        </td>

                        {/* Ячейки по дням периода */}
                        {days.map((d) => {
                          const dayData = stats.days[d.dateStr];
                          const hasHours = dayData && dayData.minutes > 0;
                          const hasTip = dayData && (dayData.waiterTip || 0) > 0;

                          let tooltip = `${emp.full_name} (${d.label} ${d.dayOfWeek})`;
                          if (hasHours) {
                            tooltip += `: ${formatMinutesToHours(dayData.minutes)} (${dayData.inTime || ""} - ${dayData.outTime || ""})`;
                          }
                          if (hasTip) {
                            tooltip += ` | % iiko: +${new Intl.NumberFormat("ru-RU").format(dayData.waiterTip!)} ₸`;
                          }

                          return (
                            <td
                              key={d.dateStr}
                              className={`p-1 text-center border-l border-gray-100 font-mono text-[10px] whitespace-nowrap ${
                                hasHours
                                  ? "bg-green-100/60 text-green-950 font-bold"
                                  : hasTip
                                  ? "bg-emerald-50/60 text-emerald-950 font-bold"
                                  : d.isWeekend
                                  ? "bg-gray-50/40 text-gray-300"
                                  : "text-gray-300"
                              }`}
                              title={tooltip}
                            >
                              <div>
                                {hasHours ? formatMinutesToHours(dayData.minutes) : "00ч 00мин"}
                              </div>
                              {hasTip && (
                                <div className="text-[9px] font-bold text-emerald-700 leading-none mt-0.5" title={`% iiko: +${dayData.waiterTip} ₸`}>
                                  +{Math.round(dayData.waiterTip! / 1000)}k
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </div>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

