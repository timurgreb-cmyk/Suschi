import { getQuizQuestions, getWeeklyQuizStatus } from "@/app/actions/quiz";
import QuizClient from "./QuizClient";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function KitchenQuizPage() {
  const [questionsRes, status] = await Promise.all([
    getQuizQuestions(),
    getWeeklyQuizStatus(),
  ]);

  if (!questionsRes.success || !questionsRes.questions || questionsRes.questions.length === 0) {
    return (
      <div className="max-w-md mx-auto p-6 pt-12 text-center space-y-4">
        <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Вопросы загружаются</h1>
        <p className="text-xs text-gray-500 leading-relaxed">
          {questionsRes.error || "Идет подготовка вопросов по номенклатуре iiko. Пожалуйста, попробуйте через минуту."}
        </p>
        <Link
          href="/app/kitchen"
          className="inline-block px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-2xl shadow-sm"
        >
          Вернуться в меню кухни
        </Link>
      </div>
    );
  }

  return (
    <QuizClient
      questions={questionsRes.questions}
      currentWeekNumber={status.currentWeekNumber}
    />
  );
}
