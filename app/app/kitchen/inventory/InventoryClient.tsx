"use client";

import { useState, useTransition, useMemo } from "react";
import { 
  PackageSearch, 
  Search, 
  Box, 
  Layers, 
  RefreshCw, 
  Plus, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Trash2, 
  Save,
  Building2
} from "lucide-react";
import Link from "next/link";
import { 
  syncInventoryFromIiko, 
  savePwaInventoryDoc, 
  TodayInventoryDoc 
} from "@/app/actions/inventory";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  mainUnit: string;
  productType: string;
}

interface Props {
  initialData: {
    lastSyncAt: string;
    goods: InventoryItem[];
    preparations: InventoryItem[];
  };
  initialStores?: { id: string; name: string }[];
  initialTodayDocs?: TodayInventoryDoc[];
}

export default function InventoryClient({ initialData, initialStores = [], initialTodayDocs = [] }: Props) {
  const [data, setData] = useState(initialData);
  const [stores] = useState(initialStores);
  const [todayDocs, setTodayDocs] = useState<TodayInventoryDoc[]>(initialTodayDocs);
  const [activeTab, setActiveTab] = useState<"revision" | "docs">("revision");
  
  const [selectedStoreId, setSelectedStoreId] = useState(stores[0]?.id || "");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [counts, setCounts] = useState<Record<string, string>>({});
  
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const allItems = useMemo(() => {
    return [...(data.goods || []), ...(data.preparations || [])];
  }, [data]);

  const categories = useMemo(() => {
    const set = new Set(allItems.map(i => i.category));
    return ["Все", ...Array.from(set)];
  }, [allItems]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      const matchCat = selectedCategory === "Все" || item.category === selectedCategory;
      const matchSearch = !searchQuery.trim() || item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allItems, selectedCategory, searchQuery]);

  const handleSync = () => {
    startTransition(async () => {
      setNotification(null);
      const res = await syncInventoryFromIiko();
      if (res.success && res.data) {
        setData(res.data);
        setNotification({ type: "success", text: `Номенклатура iiko обновлена (${res.data.goods.length + res.data.preparations.length} позиций)` });
      } else {
        setNotification({ type: "error", text: res.error || "Ошибка синхронизации" });
      }
    });
  };

  const handleCountChange = (id: string, val: string) => {
    setCounts(prev => ({ ...prev, [id]: val }));
  };

  const handleSaveDoc = async () => {
    const filledKeys = Object.keys(counts).filter(k => counts[k] && parseFloat(counts[k]) >= 0);
    if (filledKeys.length === 0) {
      setNotification({ type: "error", text: "Заполните фактический остаток хотя бы для одной позиции" });
      return;
    }

    const currentStore = stores.find(s => s.id === selectedStoreId) || { id: "default", name: "Основной склад" };
    const numItems: Record<string, number> = {};
    filledKeys.forEach(k => {
      numItems[k] = parseFloat(counts[k]);
    });

    setSaving(true);
    try {
      const res = await savePwaInventoryDoc({
        storeId: currentStore.id,
        storeName: currentStore.name,
        items: numItems,
      });

      if (res.success && res.doc) {
        setTodayDocs(prev => [res.doc!, ...prev]);
        setCounts({});
        setActiveTab("docs");
        setNotification({ type: "success", text: `Инвентаризация сохранена (${filledKeys.length} позиций)` });
      } else {
        setNotification({ type: "error", text: res.error || "Ошибка сохранения" });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const filledCount = Object.keys(counts).filter(k => counts[k] && counts[k].trim() !== "").length;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pb-28">
      {/* Шапка */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <PackageSearch className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Инвентаризация кухни
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Складской учет и остатки сырья iiko
            </p>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isPending}
          className="w-full sm:w-auto px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-slate-700 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
          <span>{isPending ? "Загрузка..." : "Обновить остатки"}</span>
        </button>
      </div>

      {notification && (
        <div className={`p-4 rounded-2xl flex items-center justify-between gap-2 text-xs font-semibold ${
          notification.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{notification.text}</span>
          </div>
          <button onClick={() => setNotification(null)}>✕</button>
        </div>
      )}

      {/* Переключатель вкладок */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit gap-1 text-xs font-bold">
        <button
          onClick={() => setActiveTab("revision")}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === "revision" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          Внесение остатков {filledCount > 0 && `(${filledCount})`}
        </button>
        <button
          onClick={() => setActiveTab("docs")}
          className={`px-4 py-2 rounded-xl transition-all ${
            activeTab === "docs" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          История за сегодня ({todayDocs.length})
        </button>
      </div>

      {activeTab === "revision" && (
        <div className="space-y-4">
          {/* Выбор склада и поиск */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Склад проведения ревизии</span>
              </label>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
              >
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Поиск сырья (лосось, рис, нори, сыр)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Список позиций для ввода */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {filteredItems.slice(0, 100).map(item => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                    {item.category}
                  </span>
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{item.name}</h4>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={counts[item.id] || ""}
                    onChange={(e) => handleCountChange(item.id, e.target.value)}
                    className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-center text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                  <span className="text-xs font-bold text-slate-400 w-8">{item.mainUnit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Кнопка отправки внизу */}
          {filledCount > 0 && (
            <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-40">
              <button
                onClick={handleSaveDoc}
                disabled={saving}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                <span>Сохранить инвентаризацию ({filledCount} поз.)</span>
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "docs" && (
        <div className="space-y-3">
          {todayDocs.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <Box className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-bold text-sm">Сегодня ревизий не проводилось</p>
            </div>
          ) : (
            todayDocs.map(doc => (
              <div key={doc.id} className="bg-white p-5 rounded-3xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{doc.documentNumber}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{doc.storeName || "Склад"}</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full">
                    {doc.statusText}
                  </span>
                </div>
                <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 flex justify-between items-center">
                  <span>Позиций: {doc.itemsCount || 0}</span>
                  <span>{new Date(doc.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
