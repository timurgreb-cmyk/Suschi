"use client";

import { resetMonthOvertimes } from "@/app/actions/timesheet";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export default function ResetOvertimesButton({ monthStr }: { monthStr: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async () => {
    if (
      !confirm(
        "ВНИМАНИЕ! Вы собираетесь сбросить ВСЕ решения по переработкам за выбранный месяц.\n\nВсе переработки вернутся в статус «Требует подтверждения». Продолжить?"
      )
    ) {
      return;
    }

    setLoading(true);
    const result = await resetMonthOvertimes(monthStr);

    if (result.error) {
      alert("Ошибка: " + result.error);
    } else {
      router.refresh();
      alert("Решения по переработкам за этот месяц успешно сброшены.");
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleReset}
      disabled={loading}
      className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 active:bg-red-200 px-4 py-2.5 rounded-xl text-sm font-bold border border-red-200 shadow-sm transition-all disabled:opacity-50 whitespace-nowrap"
    >
      <Trash2 className="w-4 h-4" />
      {loading ? "Сброс..." : "Сбросить решения"}
    </button>
  );
}
