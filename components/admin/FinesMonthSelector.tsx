"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface MonthItem {
  value: number;
  label: string;
}

export default function FinesMonthSelector({
  currentMonth,
  currentYear,
  monthsList,
}: {
  currentMonth: number;
  currentYear: number;
  monthsList: MonthItem[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set(name, value);
    router.push(`/admin/fines?${params.toString()}`);
  };

  const yearsList = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-gray-200 shadow-sm shrink-0">
      <select 
        name="month" 
        value={currentMonth}
        className="bg-transparent border-0 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-0 cursor-pointer pr-8 text-gray-900 bg-white"
        onChange={(e) => handleChange("month", e.target.value)}
      >
        {monthsList.map((m) => (
          <option key={m.value} value={m.value} className="text-gray-900 bg-white">{m.label}</option>
        ))}
      </select>
      <select 
        name="year" 
        value={currentYear}
        className="bg-transparent border-0 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-0 cursor-pointer pr-8 border-l border-gray-150 pl-3 text-gray-900 bg-white"
        onChange={(e) => handleChange("year", e.target.value)}
      >
        {yearsList.map((y) => (
          <option key={y} value={y} className="text-gray-900 bg-white">{y}</option>
        ))}
      </select>
    </div>
  );
}
