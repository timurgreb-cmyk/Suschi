"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar, ArrowRight, Check } from "lucide-react";
import { format, startOfMonth, endOfMonth, subDays, getDaysInMonth } from "date-fns";

interface MonthSelectorProps {
  currentMonth: number; // 0-11
  currentYear: number;
  dateFrom?: string; // "YYYY-MM-DD"
  dateTo?: string;   // "YYYY-MM-DD"
}

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
];

export default function MonthSelector({ 
  currentMonth, 
  currentYear,
  dateFrom,
  dateTo
}: MonthSelectorProps) {
  const router = useRouter();

  const mStr = String(currentMonth + 1).padStart(2, "0");
  const lastDayOfMonth = getDaysInMonth(new Date(currentYear, currentMonth));
  const defaultFrom = dateFrom || `${currentYear}-${mStr}-01`;
  const defaultTo = dateTo || `${currentYear}-${mStr}-${lastDayOfMonth}`;

  const [inputFrom, setInputFrom] = useState(defaultFrom);
  const [inputTo, setInputTo] = useState(defaultTo);

  useEffect(() => {
    if (dateFrom) setInputFrom(dateFrom);
    if (dateTo) setInputTo(dateTo);
  }, [dateFrom, dateTo]);

  // Массив годов от текущего -3 до текущего +1
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 3 + i);

  const navigateMonth = (targetMonth: number, targetYear: number) => {
    let m = targetMonth;
    let y = targetYear;

    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }

    const newMStr = String(m + 1).padStart(2, "0");
    const lastDay = getDaysInMonth(new Date(y, m));
    const newFrom = `${y}-${newMStr}-01`;
    const newTo = `${y}-${newMStr}-${lastDay}`;

    setInputFrom(newFrom);
    setInputTo(newTo);
    router.push(`/admin/timesheet?dateFrom=${newFrom}&dateTo=${newTo}&month=${m}&year=${y}`);
  };

  const applyCustomRange = () => {
    if (!inputFrom || !inputTo) return;
    const [from, to] = inputFrom <= inputTo ? [inputFrom, inputTo] : [inputTo, inputFrom];
    const fromDate = new Date(from);
    router.push(`/admin/timesheet?dateFrom=${from}&dateTo=${to}&month=${fromDate.getMonth()}&year=${fromDate.getFullYear()}`);
  };

  const applyPreset = (type: "full_month" | "first_half" | "second_half" | "today" | "yesterday" | "last_7") => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    if (type === "full_month") {
      const from = `${currentYear}-${mStr}-01`;
      const to = `${currentYear}-${mStr}-${lastDayOfMonth}`;
      setInputFrom(from);
      setInputTo(to);
      router.push(`/admin/timesheet?dateFrom=${from}&dateTo=${to}&month=${currentMonth}&year=${currentYear}`);
    } else if (type === "first_half") {
      const from = `${currentYear}-${mStr}-01`;
      const to = `${currentYear}-${mStr}-15`;
      setInputFrom(from);
      setInputTo(to);
      router.push(`/admin/timesheet?dateFrom=${from}&dateTo=${to}&month=${currentMonth}&year=${currentYear}`);
    } else if (type === "second_half") {
      const from = `${currentYear}-${mStr}-16`;
      const to = `${currentYear}-${mStr}-${lastDayOfMonth}`;
      setInputFrom(from);
      setInputTo(to);
      router.push(`/admin/timesheet?dateFrom=${from}&dateTo=${to}&month=${currentMonth}&year=${currentYear}`);
    } else if (type === "today") {
      setInputFrom(todayStr);
      setInputTo(todayStr);
      router.push(`/admin/timesheet?dateFrom=${todayStr}&dateTo=${todayStr}&month=${today.getMonth()}&year=${today.getFullYear()}`);
    } else if (type === "yesterday") {
      const yest = format(subDays(today, 1), "yyyy-MM-dd");
      setInputFrom(yest);
      setInputTo(yest);
      router.push(`/admin/timesheet?dateFrom=${yest}&dateTo=${yest}&month=${today.getMonth()}&year=${today.getFullYear()}`);
    } else if (type === "last_7") {
      const from = format(subDays(today, 6), "yyyy-MM-dd");
      setInputFrom(from);
      setInputTo(todayStr);
      router.push(`/admin/timesheet?dateFrom=${from}&dateTo=${todayStr}&month=${today.getMonth()}&year=${today.getFullYear()}`);
    }
  };

  const isFullMonth = inputFrom === `${currentYear}-${mStr}-01` && inputTo === `${currentYear}-${mStr}-${lastDayOfMonth}`;
  const isFirstHalf = inputFrom === `${currentYear}-${mStr}-01` && inputTo === `${currentYear}-${mStr}-15`;
  const isSecondHalf = inputFrom === `${currentYear}-${mStr}-16` && inputTo === `${currentYear}-${mStr}-${lastDayOfMonth}`;
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isToday = inputFrom === todayStr && inputTo === todayStr;

  return (
    <div className="flex flex-col gap-2.5 bg-white rounded-2xl shadow-sm border border-gray-200 p-3 w-full sm:w-auto">
      
      {/* Верхний ряд: быстрый выбор месяца/года + произвольные даты */}
      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
        
        {/* Селектор месяца/года */}
        <div className="flex items-center space-x-1 bg-gray-50 rounded-xl border border-gray-200 px-1.5 py-1">
          <button
            onClick={() => navigateMonth(currentMonth - 1, currentYear)}
            className="p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
            title="Предыдущий месяц"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <select
            value={currentMonth}
            onChange={(e) => navigateMonth(parseInt(e.target.value), currentYear)}
            className="bg-transparent text-xs font-bold text-gray-800 outline-none cursor-pointer py-0.5 px-1 hover:bg-gray-100 rounded"
          >
            {MONTHS.map((name, index) => (
              <option key={index} value={index}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={currentYear}
            onChange={(e) => navigateMonth(currentMonth, parseInt(e.target.value))}
            className="bg-transparent text-xs font-bold text-gray-800 outline-none cursor-pointer py-0.5 px-1 hover:bg-gray-100 rounded"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <button
            onClick={() => navigateMonth(currentMonth + 1, currentYear)}
            className="p-1 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
            title="Следующий месяц"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Поля ввода диапазона дат: С ... ПО ... */}
        <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl border border-gray-200 px-2 py-1">
          <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <div className="flex items-center gap-1 text-xs">
            <span className="text-[11px] font-semibold text-gray-400">С:</span>
            <input 
              type="date" 
              value={inputFrom}
              onChange={(e) => setInputFrom(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-gray-800 outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-[11px] font-semibold text-gray-400">По:</span>
            <input 
              type="date" 
              value={inputTo}
              onChange={(e) => setInputTo(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-gray-800 outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={applyCustomRange}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs px-2.5 py-1 rounded-lg transition-all shadow-sm flex items-center gap-1"
            title="Применить выбранный период"
          >
            <span>Показать</span>
          </button>
        </div>
      </div>

      {/* Нижний ряд: кнопки-таблетки быстрого выбора периода */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100 text-xs">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">
          Период:
        </span>

        <button
          onClick={() => applyPreset("full_month")}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
            isFullMonth 
              ? "bg-emerald-600 text-white shadow-sm" 
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Весь месяц
        </button>

        <button
          onClick={() => applyPreset("first_half")}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
            isFirstHalf 
              ? "bg-emerald-600 text-white shadow-sm" 
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          1 — 15 (Аванс)
        </button>

        <button
          onClick={() => applyPreset("second_half")}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
            isSecondHalf 
              ? "bg-emerald-600 text-white shadow-sm" 
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          16 — конец (Зарплата)
        </button>

        <button
          onClick={() => applyPreset("today")}
          className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
            isToday 
              ? "bg-emerald-600 text-white shadow-sm" 
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Сегодня
        </button>

        <button
          onClick={() => applyPreset("yesterday")}
          className="px-2.5 py-1 rounded-lg font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
        >
          Вчера
        </button>

        <button
          onClick={() => applyPreset("last_7")}
          className="px-2.5 py-1 rounded-lg font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all"
        >
          7 дней
        </button>
      </div>

    </div>
  );
}

