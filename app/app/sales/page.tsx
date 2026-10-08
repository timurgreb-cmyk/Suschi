import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { startOfMonth, endOfMonth, format, addMonths, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  TrendingUp, 
  Wallet, 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Coins, 
  Receipt,
  UserCircle
} from "lucide-react";
import Link from "next/link";
import { getIikoWaiterServiceTips } from "@/utils/iiko/client";
import { formatDisplayName } from "@/utils/formatters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: { month?: string; year?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Необходима авторизация</p>
      </div>
    );
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const currentMonth = searchParams.month ? parseInt(searchParams.month) : now.getMonth();
  const currentYear = searchParams.year ? parseInt(searchParams.year) : now.getFullYear();

  const selectedDate = new Date(currentYear, currentMonth, 1);
  const startDate = startOfMonth(selectedDate);
  const endDate = endOfMonth(selectedDate);

  const prevDate = subMonths(selectedDate, 1);
  const nextDate = addMonths(selectedDate, 1);

  const dateFromStr = format(startDate, "yyyy-MM-dd");
  const dateToStr = format(endDate, "yyyy-MM-dd");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, position")
    .eq("id", user.id)
    .single();

  const employeeName = formatDisplayName(profile?.full_name);

  const { daily } = await getIikoWaiterServiceTips({
    dateFrom: dateFromStr,
    dateTo: dateToStr,
  });

  const mySales = daily.filter((d) => {
    const wName = d.waiterName.toLowerCase().trim();
    const myName = employeeName.toLowerCase().trim();
    return wName === myName || wName.includes(myName) || myName.includes(wName);
  });

  const totalBonus = mySales.reduce((acc, s) => acc + s.waiterBonus, 0);
  const totalRevenue = mySales.reduce((acc, s) => acc + s.dishSum, 0);

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6 pb-28">
      {/* Шапка */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Мои продажи и бонусы</h1>
              <p className="text-xs text-slate-500">{employeeName}</p>
            </div>
          </div>
        </div>

        {/* Навигация по месяцам */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <Link
            href={`/app/sales?month=${prevDate.getMonth()}&year=${prevDate.getFullYear()}`}
            className="p-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {format(selectedDate, "LLLL yyyy", { locale: ru })}
          </span>
          <Link
            href={`/app/sales?month=${nextDate.getMonth()}&year=${nextDate.getFullYear()}`}
            className="p-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Карточки итогов */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Личные бонусы iiko
          </span>
          <div className="text-2xl font-black text-amber-600 font-mono">
            {totalBonus.toLocaleString("ru-RU")} ₸
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
            Выручка по чекам
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {totalRevenue.toLocaleString("ru-RU")} ₸
          </div>
        </div>
      </div>

      {/* Список смен */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
          История смен ({mySales.length})
        </h3>

        {mySales.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 text-slate-400 text-xs">
            Нет данных о продажах за выбранный месяц
          </div>
        ) : (
          mySales.map((s, idx) => (
            <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800">{s.date}</span>
                <p className="text-[11px] text-slate-400">Выручка: {s.dishSum.toLocaleString("ru-RU")} ₸</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-amber-600 font-mono">
                  +{s.waiterBonus.toLocaleString("ru-RU")} ₸
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
