"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowLeft, Camera, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { submitChecklist } from "@/app/actions/checklists";

interface Item {
  id: string;
  title: string;
  description?: string;
  item_type: "boolean" | "text" | "number" | "photo";
  is_required: boolean;
  sort_order: number;
}

interface ChecklistTemplate {
  id: string;
  title: string;
  description?: string;
  shift_type: string;
  items: Item[];
}

export default function ChecklistFillForm({ template }: { template: ChecklistTemplate }) {
  const router = useRouter();
  const [entries, setEntries] = useState<Record<string, { boolValue?: boolean; textValue?: string; numberValue?: number; photoUrl?: string }>>(() => {
    const initial: Record<string, any> = {};
    template.items.forEach((item) => {
      initial[item.id] = {
        boolValue: false,
        textValue: "",
        numberValue: undefined,
        photoUrl: "",
      };
    });
    return initial;
  });

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const toggleCheck = (itemId: string) => {
    setEntries((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        boolValue: !prev[itemId]?.boolValue,
      },
    }));
  };

  const updateText = (itemId: string, val: string) => {
    setEntries((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        textValue: val,
      },
    }));
  };

  const updateNumber = (itemId: string, val: string) => {
    setEntries((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        numberValue: val ? parseFloat(val) : undefined,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const formattedEntries = Object.entries(entries).map(([templateItemId, vals]) => ({
        templateItemId,
        boolValue: vals.boolValue,
        textValue: vals.textValue,
        numberValue: vals.numberValue,
        photoUrl: vals.photoUrl,
      }));

      const res = await submitChecklist({
        templateId: template.id,
        notes,
        entries: formattedEntries,
      });

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/app/checklists");
          router.refresh();
        }, 1500);
      } else {
        setError(res.error || "Ошибка сохранения чек-листа");
      }
    } catch (err: any) {
      setError(err.message || "Ошибка отправки");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto p-6 pt-16 text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Чек-лист отправлен!</h2>
        <p className="text-xs text-slate-500">Спасибо за соблюдение регламентов смены</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6 pb-28">
      <div className="flex items-center gap-3">
        <Link
          href="/app/checklists"
          className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900">{template.title}</h1>
          <p className="text-xs text-slate-500">{template.description || "Заполнение чек-листа"}</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 text-xs font-semibold rounded-2xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          {template.items.map((item, idx) => {
            const currentVal = entries[item.id];

            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                      Пункт {idx + 1}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                    {item.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                    )}
                  </div>

                  {item.item_type === "boolean" && (
                    <button
                      type="button"
                      onClick={() => toggleCheck(item.id)}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                        currentVal?.boolValue
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                          : "bg-slate-100 text-transparent hover:bg-slate-200"
                      }`}
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {item.item_type === "number" && (
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Введите значение..."
                    value={currentVal?.numberValue ?? ""}
                    onChange={(e) => updateNumber(item.id, e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-primary focus:bg-white"
                  />
                )}

                {item.item_type === "text" && (
                  <input
                    type="text"
                    placeholder="Введите комментарий..."
                    value={currentVal?.textValue || ""}
                    onChange={(e) => updateText(item.id, e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary focus:bg-white"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Общий комментарий к смене
          </label>
          <textarea
            rows={2}
            placeholder="Замечания, остатки, комментарии..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-primary"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-primary hover:bg-primary/95 text-white font-bold text-sm rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          <span>Завершить и отправить</span>
        </button>
      </form>
    </div>
  );
}
