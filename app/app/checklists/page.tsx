import { getChecklistTemplates, getEmployeeTodaySubmissions } from "@/app/actions/checklists";
import Link from "next/link";
import { 
  ClipboardCheck, 
  CheckCircle2, 
  ArrowRight, 
  ChefHat, 
  Trophy,
  Award
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EmployeeChecklistsPage() {
  const [allTemplates, todaySubmissions] = await Promise.all([
    getChecklistTemplates(),
    getEmployeeTodaySubmissions(),
  ]);

  const templates = allTemplates.filter(
    (t: any) => !t.title.toLowerCase().includes("аттестация")
  );

  const completedTemplateIds = new Set(todaySubmissions.map((s: any) => s.template_id));

  const getShiftBadge = (type: string) => {
    switch (type) {
      case "opening":
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Утро / Открытие</span>;
      case "closing":
        return <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Вечер / Закрытие</span>;
      case "day":
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Дневной</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full">Чек-лист</span>;
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-6 font-sans space-y-6 pb-28">
      {/* Шапка */}
      <div>
        <div className="flex items-center space-x-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
          <ClipboardCheck className="w-4 h-4" />
          <span>Контроль регламентов</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Чек-листы смены</h1>
        <p className="text-xs text-slate-500 mt-0.5 capitalize">
          {format(new Date(), "d MMMM yyyy, EEEE", { locale: ru })}
        </p>
      </div>

      {/* Баннер аттестации */}
      <Link
        href="/app/kitchen/quiz"
        className="block bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-3xl p-5 shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                Еженедельно
              </span>
              <h3 className="font-black text-base mt-1">Аттестация по ТТК iiko</h3>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-white/80" />
        </div>
      </Link>

      {/* Список чек-листов */}
      <div className="space-y-3">
        <h2 className="text-xs font-black uppercase tracking-wider text-slate-400">
          Чек-листы на сегодня ({templates.length})
        </h2>

        {templates.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 text-slate-400 text-xs">
            Нет активных чек-листов
          </div>
        ) : (
          templates.map((t: any) => {
            const isCompleted = completedTemplateIds.has(t.id);
            return (
              <Link
                key={t.id}
                href={`/app/checklists/${t.id}`}
                className={`block bg-white rounded-3xl p-5 border shadow-sm transition-all active:scale-[0.98] ${
                  isCompleted 
                    ? "border-emerald-300 bg-emerald-50/20" 
                    : "border-slate-200 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getShiftBadge(t.shift_type)}
                      {isCompleted && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Заполнен
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">{t.title}</h3>
                    {t.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                    )}
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-300 shrink-0" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
