"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteChecklistTemplate } from "@/app/actions/checklists";
import { useRouter } from "next/navigation";

export default function DeleteTemplateButton({ templateId }: { templateId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Вы уверены, что хотите удалить этот шаблон чек-листа?")) {
      return;
    }

    setLoading(true);
    try {
      const res = await deleteChecklistTemplate(templateId);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error || "Ошибка удаления");
      }
    } catch (err: any) {
      alert(err.message || "Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
      title="Удалить шаблон"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
