"use client";

import { useState } from "react";
import { Plus, Trash2, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { createChecklistTemplate } from "@/app/actions/checklists";
import { useRouter } from "next/navigation";

interface ItemRow {
  title: string;
  description: string;
  item_type: "boolean" | "text" | "number" | "photo";
  is_required: boolean;
}

export default function CreateTemplateModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shiftType, setShiftType] = useState<"opening" | "closing" | "day" | "any">("opening");
  const [items, setItems] = useState<ItemRow[]>([
    { title: "Проверить чистоту суши-цеха и столов", description: "", item_type: "boolean", is_required: true },
    { title: "Зафиксировать температуру в холодильниках", description: "Норма: от +2°C до +4°C", item_type: "number", is_required: true },
    { title: "Проверить готовность риса и заготовок рыбы", description: "", item_type: "boolean", is_required: true },
    { title: "Фото открытой витрины и цеха", description: "", item_type: "photo", is_required: true },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { title: "", description: "", item_type: "boolean", is_required: true },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ItemRow, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Укажите название чек-листа");
      return;
    }

    const validItems = items.filter((i) => i.title.trim().length > 0);
    if (validItems.length === 0) {
      setError("Добавьте хотя бы один пункт чек-листа");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createChecklistTemplate({
        title,
        description,
        shift_type: shiftType,
        items: validItems,
      });

      if (res.success) {
        setIsOpen(false);
        setTitle("");
        setDescription("");
        router.refresh();
      } else {
        setError(res.error || "Ошибка создания шаблона");
      }
    } catch (err: any) {
      setError(err.message || "Непредвиденная ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/95 shadow-sm active:scale-95 transition-all"
      >
        <Plus className="w-4 h-4 mr-2" />
        Создать шаблон
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg">Новый шаблон чек-листа</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Название чек-листа *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Чек-лист открытия смены (Суши-бар)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Тип смены
                  </label>
                  <select
                    value={shiftType}
                    onChange={(e: any) => setShiftType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-white"
                  >
                    <option value="opening">Утро / Открытие</option>
                    <option value="closing">Вечер / Закрытие</option>
                    <option value="day">Дневной</option>
                    <option value="any">Любое время</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Описание
                  </label>
                  <input
                    type="text"
                    placeholder="Для поваров и кассиров"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-medium"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Пункты проверки ({items.length})
                  </label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Добавить пункт
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 w-5 text-center">{idx + 1}.</span>
                        <input
                          type="text"
                          required
                          placeholder="Что нужно проверить..."
                          value={item.title}
                          onChange={(e) => updateItem(idx, "title", e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                        />
                        <select
                          value={item.item_type}
                          onChange={(e: any) => updateItem(idx, "item_type", e.target.value)}
                          className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white font-medium"
                        >
                          <option value="boolean">Галочка (Да/Нет)</option>
                          <option value="number">Число / Градусы</option>
                          <option value="photo">Фотоотчет</option>
                          <option value="text">Текст</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Подсказка / регламент (необязательно)"
                        value={item.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                        className="w-full px-3 py-1 text-[11px] text-gray-500 bg-transparent border-b border-gray-200/60 focus:outline-none focus:border-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit button */}
              <div className="pt-4 border-t border-gray-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Сохранить шаблон</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
