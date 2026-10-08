"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { 
  UtensilsCrossed, 
  Search, 
  ChefHat, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Scale, 
  Clock, 
  Layers, 
  FileText,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { IikoRecipesPayload, IikoRecipe } from "@/utils/iiko/calculations";
import { syncCalculationsFromIiko } from "@/app/actions/calculations";

interface Props {
  initialData: IikoRecipesPayload;
}

export default function CalculationsClient({ initialData }: Props) {
  const [data, setData] = useState<IikoRecipesPayload>(initialData);
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const categories = ["Все", ...(data.categories || [])];

  const handleSync = () => {
    startTransition(async () => {
      setSyncMessage(null);
      const res = await syncCalculationsFromIiko();
      if (res.success && res.data) {
        setData(res.data);
        setSyncMessage(`Успешно обновлено: ${res.data.totalCount} блюд из iiko!`);
        setTimeout(() => setSyncMessage(null), 4000);
      } else {
        setSyncMessage(res.error || "Ошибка обновления");
      }
    });
  };

  const filteredRecipes = (data.recipes || []).filter((r) => {
    const matchesCategory = selectedCategory === "Все" || r.category === selectedCategory;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return matchesCategory;

    const matchesName = r.name.toLowerCase().includes(query);
    const matchesCode = r.code.toLowerCase().includes(query);
    const matchesIngredient = r.ingredients?.some((ing) => ing.name.toLowerCase().includes(query));

    return matchesCategory && (matchesName || matchesCode || matchesIngredient);
  });

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pb-28">
      {/* Шапка */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Технологические карты
              </h1>
              <span className="bg-amber-100 text-amber-800 text-xs font-black px-2 py-0.5 rounded-full">
                iiko
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Всего блюд: {data.totalCount || 0}
            </p>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isPending}
          className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-95 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin" : ""}`} />
          <span>{isPending ? "Загрузка из iiko..." : "Синхронизировать"}</span>
        </button>
      </div>

      {syncMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Поиск и категории */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по названию блюда или ингредиенту (лосось, сыр, рис)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Горизонтальный скролл категорий */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                    : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Список блюд */}
      <div className="space-y-3">
        {filteredRecipes.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
            <UtensilsCrossed className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-bold text-sm">Блюда не найдены</p>
            <p className="text-slate-400 text-xs mt-1">Попробуйте изменить запрос или категорию</p>
          </div>
        ) : (
          filteredRecipes.map((recipe) => {
            const isExpanded = expandedId === recipe.id;
            return (
              <div
                key={recipe.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-amber-500/40"
              >
                {/* Карточка блюда */}
                <button
                  onClick={() => toggleExpand(recipe.id)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {recipe.category}
                      </span>
                      {recipe.code && (
                        <span className="text-[10px] font-mono text-slate-400">
                          #{recipe.code}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 text-base sm:text-lg truncate">
                      {recipe.name}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        <Scale className="w-3.5 h-3.5 text-amber-500" />
                        Выход: {recipe.yield}
                      </span>
                      <span>•</span>
                      <span>Ингредиентов: {recipe.ingredientsCount}</span>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Раскрывающийся состав и техкарта */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 bg-slate-50/60 border-t border-slate-100 space-y-4 animate-in fade-in duration-150">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-amber-600" />
                        Раскладка ингредиентов (на порцию):
                      </h4>
                      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                        {recipe.ingredients.map((ing, idx) => (
                          <div
                            key={idx}
                            className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 pr-2">
                              <span className="w-4 text-slate-400 font-mono text-[10px]">{idx + 1}.</span>
                              <span className="font-medium text-slate-800">{ing.name}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                                {ing.formattedNet || ing.formattedGross}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {recipe.technology && (
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-amber-600" />
                          Технология приготовления:
                        </h4>
                        <div className="p-4 bg-white rounded-2xl border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {recipe.technology}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
