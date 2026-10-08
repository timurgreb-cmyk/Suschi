import Link from "next/link";
import { UtensilsCrossed, PackageSearch, Award, ChevronRight, ShieldAlert } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6 text-center text-gray-500 flex flex-col items-center justify-center min-h-[50vh]">
        <ShieldAlert className="w-12 h-12 text-slate-300 mb-4" />
        <p>Необходима авторизация</p>
      </div>
    );
  }

  return (
    <div className="p-6 pb-24 max-w-lg mx-auto w-full flex flex-col space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Суши-цех & Кухня</h1>
        <p className="text-slate-500 mt-1">Технологические карты, ревизия и аттестация iiko</p>
      </div>

      <div className="grid gap-4">
        {/* Калькуляции */}
        <Link 
          href="/app/kitchen/recipes"
          className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm active:scale-[0.98] transition-all flex items-center justify-between group hover:border-amber-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">Технологические карты</h3>
              <p className="text-sm text-slate-500">Рецепты и раскладки iiko</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" />
        </Link>

        {/* Инвентаризация */}
        <Link 
          href="/app/kitchen/inventory"
          className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm active:scale-[0.98] transition-all flex items-center justify-between group hover:border-emerald-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <PackageSearch className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">Инвентаризация</h3>
              <p className="text-sm text-slate-500">Ревизия склада и остатков</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
        </Link>

        {/* Аттестация */}
        <Link 
          href="/app/kitchen/quiz"
          className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm active:scale-[0.98] transition-all flex items-center justify-between group hover:border-indigo-300"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">Аттестация по меню</h3>
              <p className="text-sm text-slate-500">Тест знаний граммовок ТТК</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
        </Link>
      </div>
    </div>
  );
}
