"use client";

import { Printer, X, FileText } from "lucide-react";
import { formatDisplayName, formatPositionName } from "@/utils/formatters";

interface AdvanceStatementProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  position?: string;
  amount: number;
  reason?: string;
  date?: string;
}

export default function AdvanceStatementModal({
  isOpen,
  onClose,
  employeeName: rawEmployeeName,
  position: rawPosition,
  amount,
  reason,
  date,
}: AdvanceStatementProps) {
  if (!isOpen) return null;

  const employeeName = formatDisplayName(rawEmployeeName);
  const position = formatPositionName(rawPosition, "genitive");

  const displayDate = date 
    ? new Date(date).toLocaleDateString("ru-RU") 
    : new Date().toLocaleDateString("ru-RU");

  const formattedAmount = new Intl.NumberFormat("ru-RU").format(amount);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:w-full print:rounded-none animate-in fade-in zoom-in-95 duration-150 border border-gray-200">
        
        {/* Кнопки управления (скрываются при печати) */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 print:hidden">
          <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
            <FileText className="w-4 h-4 text-primary" />
            <span>Заявление на выдачу аванса</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Распечатать / Сохранить в PDF</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Лист Заявления */}
        <div className="p-8 sm:p-12 overflow-y-auto flex-1 bg-white font-serif text-gray-900 leading-relaxed print:p-8 print:text-black">
          
          <div className="flex justify-end mb-12">
            <div className="w-64 text-right sm:text-left text-sm space-y-1">
              <p className="font-semibold text-gray-900">Руководству Sushi Control</p>
              <p className="font-semibold text-gray-900">Директору</p>
              <p className="mt-2 text-gray-700">от {position}</p>
              <p className="font-bold text-base text-gray-950">{employeeName}</p>
            </div>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-wider font-sans text-gray-950">
              Заявление
            </h1>
          </div>

          <div className="text-base sm:text-lg text-justify indent-8 space-y-6 mb-16 text-gray-900">
            <p>
              Я, <span className="font-bold border-b border-gray-400 pb-0.5 text-black">{employeeName}</span>, 
              прошу выдать мне аванс в размере{" "}
              <span className="font-bold text-lg font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-300 text-black print:border-none">
                {formattedAmount} ₸
              </span>.
            </p>

            {reason && (
              <p className="text-sm text-gray-700 font-sans italic bg-gray-50 p-4 rounded-xl border border-gray-200 print:border-none print:bg-transparent print:p-0">
                <span className="font-bold not-italic text-gray-900">Причина запроса:</span> {reason}
              </p>
            )}
          </div>

          <div className="flex justify-between items-end pt-8 border-t border-gray-200 text-sm font-sans">
            <div>
              <p className="text-gray-500 text-xs">Дата подачи:</p>
              <p className="font-bold text-base text-gray-900 mt-1">{displayDate}</p>
            </div>

            <div className="text-right">
              <p className="text-gray-500 text-xs mb-4">Подпись сотрудника:</p>
              <div className="w-48 border-b-2 border-gray-800 pb-1 text-center font-cursive text-lg text-gray-900">
                ___________________
              </div>
            </div>
          </div>

          <div className="mt-12 p-4 border border-dashed border-gray-300 rounded-2xl print:block text-xs font-sans text-gray-700 space-y-2 bg-gray-50">
            <p className="font-bold text-gray-900 uppercase tracking-wider">Резолюция руководителя:</p>
            <div className="flex items-center gap-6 pt-1">
              <span>[ &nbsp; ] Согласовано к выплате: ________________ ₸</span>
              <span>[ &nbsp; ] Отказано</span>
            </div>
            <p className="pt-2">Подпись руководителя: __________________ / ______________ /</p>
          </div>

        </div>
      </div>
    </div>
  );
}
