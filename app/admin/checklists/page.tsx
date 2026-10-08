import { getChecklistTemplates, getSubmissionsForDate } from "@/app/actions/checklists";
import CreateTemplateModal from "./CreateTemplateModal";
import DeleteTemplateButton from "./DeleteTemplateButton";
import LocalTime from "@/components/LocalTime";
import { ClipboardCheck, CheckCircle2, FileText, Image as ImageIcon } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminChecklistsPage({
  searchParams,
}: {
  searchParams?: { date?: string };
}) {
  const selectedDate = searchParams?.date || new Date().toISOString().split("T")[0];
  const templates = await getChecklistTemplates({ activeOnly: false });
  const submissions = await getSubmissionsForDate(selectedDate);

  const getShiftBadge = (type: string) => {
    switch (type) {
      case "opening":
        return <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Утро / Открытие</span>;
      case "closing":
        return <span className="bg-indigo-100 text-indigo-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Вечер / Закрытие</span>;
      case "day":
        return <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Дневной</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">Общий</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Система чек-листов</h1>
          <p className="text-sm text-gray-500 mt-1">
            Контроль стандартов открытия/закрытия смен и санитарных регламентов суши-бара
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CreateTemplateModal />
        </div>
      </div>

      {/* Date Selector & Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Дата проверки
          </label>
          <form method="GET" className="flex items-center space-x-2">
            <input
              type="date"
              name="date"
              defaultValue={selectedDate}
              className="text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-full"
            />
            <button
              type="submit"
              className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
            >
              Найти
            </button>
          </form>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Заполнено за день</span>
          <div className="text-3xl font-bold text-primary mt-2">{submissions.length}</div>
          <span className="text-xs text-gray-400 mt-1 block">отчетов от сотрудников</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Активных шаблонов</span>
          <div className="text-3xl font-bold text-gray-900 mt-2">{templates.length}</div>
          <span className="text-xs text-gray-400 mt-1 block">чек-листов в системе</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Статус контроля</span>
          <div className="text-sm font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-xl mt-3 inline-flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Система активна
          </div>
        </div>
      </div>

      {/* Submissions Section */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          <span>Отчёты сотрудников за {selectedDate}</span>
        </h2>

        {submissions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-200 shadow-sm">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">
              За выбранную дату ({selectedDate}) отчетов пока нет.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((sub: any) => (
              <div
                key={sub.id}
                className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:border-primary/30 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-base">
                        {sub.checklist_templates?.title || "Чек-лист"}
                      </h3>
                      {getShiftBadge(sub.checklist_templates?.shift_type)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Сотрудник: <span className="font-semibold text-gray-800">{sub.profiles?.full_name || "Сотрудник"}</span> ({sub.profiles?.position || "—"}) • Точка: {sub.locations?.name || "Основная"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">Время отправки:</span>
                    <div className="text-xs font-bold text-gray-700">
                      <LocalTime isoString={sub.completed_at || sub.created_at} formatStr="dd.MM.yyyy HH:mm" />
                    </div>
                  </div>
                </div>

                {/* Entries */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {(sub.checklist_submission_entries || []).map((entry: any) => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs"
                    >
                      <span className="font-medium text-gray-700 pr-2">
                        {entry.checklist_template_items?.title || "Пункт"}
                      </span>

                      <div className="shrink-0 font-bold">
                        {entry.checklist_template_items?.item_type === "boolean" && (
                          entry.bool_value ? (
                            <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Да
                            </span>
                          ) : (
                            <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded-md">
                              Нет
                            </span>
                          )
                        )}

                        {entry.checklist_template_items?.item_type === "number" && (
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-mono">
                            {entry.number_value}
                          </span>
                        )}

                        {entry.checklist_template_items?.item_type === "text" && (
                          <span className="text-gray-800 italic">
                            «{entry.text_value || "—"}»
                          </span>
                        )}

                        {entry.checklist_template_items?.item_type === "photo" && (
                          entry.photo_url ? (
                            <a
                              href={entry.photo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              <ImageIcon className="w-3.5 h-3.5" /> Фото
                            </a>
                          ) : (
                            <span className="text-gray-400">Фото отсутствует</span>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {sub.notes && (
                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-xs text-amber-900">
                    <span className="font-bold">Комментарий сотрудника:</span> {sub.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Templates Management Section */}
      <div className="pt-6 border-t border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Шаблоны чек-листов</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t: any) => (
            <div
              key={t.id}
              className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{t.title}</h3>
                    {t.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                    )}
                  </div>
                  <DeleteTemplateButton templateId={t.id} />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {getShiftBadge(t.shift_type)}
                  <span className="text-xs text-gray-400">
                    Пунктов проверки: {t.items?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
