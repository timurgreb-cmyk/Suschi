"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { triggerIikoAttendanceSync } from "@/app/actions/iiko";
import { useRouter } from "next/navigation";

export default function IikoSyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const handleSync = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await triggerIikoAttendanceSync();
      if (res.success && res.data) {
        const text = `Синхронизация успешна! Найдено смен в iiko: ${res.data.totalShiftsFound || 0}, загружено: ${res.data.insertedRecords || 0}.`;
        setMessage({ type: "success", text });
        router.refresh();
      } else {
        setMessage({ type: "error", text: res.error || "Не удалось синхронизировать" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Ошибка сети" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <button
        onClick={handleSync}
        disabled={loading}
        className="inline-flex items-center px-4 py-2 bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-300 text-xs sm:text-sm font-bold rounded-2xl hover:bg-indigo-500/20 active:scale-95 transition-all disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 mr-2 text-indigo-500 dark:text-indigo-400 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Синхронизация с iiko..." : "Синхронизировать с iiko"}
      </button>

      {message && (
        <div
          className={`flex items-center px-3.5 py-2 rounded-xl text-xs font-bold ${
            message.type === "success" 
              ? "bg-green-500/10 text-green-600 dark:text-green-300 border border-green-500/20" 
              : "bg-red-500/10 text-red-600 dark:text-red-300 border border-red-500/20"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
}
