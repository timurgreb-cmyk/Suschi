"use client";

import { deleteAllRecords } from "@/app/actions/time-records";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export default function ResetAttendanceButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async () => {
    if (
      !confirm(
        "ВНИМАНИЕ! Вы собираетесь ПОЛНОСТЬЮ удалить все отметки прихода и ухода всех сотрудников за всё время.\n\nЭто действие необратимо и полностью очистит журнал и табели. Продолжить?"
      )
    ) {
      return;
    }

    if (
      !confirm(
        "ПОДТВЕРДИТЕ ЕЩЕ РАЗ:\nВы действительно хотите удалить все отметки времени?"
      )
    ) {
      return;
    }

    setLoading(true);
    const result = await deleteAllRecords();

    if (result.error) {
      alert("Ошибка: " + result.error);
    } else {
      router.refresh();
      alert("Все отметки были успешно удалены.");
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
      {loading ? "Сброс..." : "Очистить все отметки"}
    </button>
  );
}
