"use client";

import { useState } from "react";
import { QuizQuestion } from "@/utils/iiko/quiz-generator";
import { submitQuizAttempt, QuizAttemptResult } from "@/app/actions/quiz";
import { 
  ChefHat, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  RotateCcw, 
  Trophy, 
  Layers, 
  Sparkles,
  Loader2
} from "lucide-react";
import Link from "next/link";

interface Props {
  questions: QuizQuestion[];
  currentWeekNumber: number;
}

export default function QuizClient({ questions, currentWeekNumber }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  
  const [answers, setAnswers] = useState<Array<{
    questionId: string;
    selectedIndex: number;
    isCorrect: boolean;
  }>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<QuizAttemptResult | null>(null);

  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;
  const progressPercent = Math.round(((currentIndex + (isAnswered ? 1 : 0)) / totalQuestions) * 100);

  const handleSelectOption = (idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    setIsAnswered(true);

    const isCorrect = idx === currentQ.correctIndex;
    const newAnswers = [
      ...answers,
      {
        questionId: currentQ.id,
        selectedIndex: idx,
        isCorrect,
      },
    ];
    setAnswers(newAnswers);

    if (currentIndex === totalQuestions - 1) {
      const finalScore = newAnswers.filter((a) => a.isCorrect).length;
      handleSubmit(finalScore, newAnswers);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    }
  };

  const handleSubmit = async (
    finalScore: number,
    finalAnswers: Array<{ questionId: string; selectedIndex: number; isCorrect: boolean }>
  ) => {
    setIsSubmitting(true);
    try {
      const res = await submitQuizAttempt({
        score: finalScore,
        totalQuestions,
        answers: finalAnswers.reduce((acc, a) => ({ ...acc, [a.questionId]: a.selectedIndex }), {}),
      });

      if (res.success && res.result) {
        setQuizResult(res.result);
      }
    } catch (err) {
      console.error("Submit quiz error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (quizResult) {
    const isPassed = quizResult.passed;
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 pt-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className={`p-8 rounded-3xl text-center border space-y-4 ${
          isPassed 
            ? "bg-emerald-50 border-emerald-200 text-emerald-950" 
            : "bg-red-50 border-red-200 text-red-950"
        }`}>
          <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center ${
            isPassed ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
          }`}>
            <Trophy className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-black uppercase tracking-wider opacity-60">
              Неделя {quizResult.weekNumber}
            </span>
            <h1 className="text-2xl font-black mt-1">{quizResult.gradeLabel}</h1>
            <p className="text-sm mt-1 opacity-80">
              Правильных ответов: <span className="font-bold">{quizResult.score}</span> из {quizResult.totalQuestions} ({quizResult.percentage}%)
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/app/kitchen"
              className="block w-full py-3.5 bg-slate-900 text-white font-bold text-xs rounded-2xl shadow-lg hover:bg-black transition-all"
            >
              Вернуться в меню кухни
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6 pb-28">
      {/* Шапка прогресса */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5 text-slate-800">
            <ChefHat className="w-4 h-4 text-indigo-600" />
            <span>Аттестация ТТК iiko</span>
          </span>
          <span>{currentIndex + 1} из {totalQuestions}</span>
        </div>

        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Вопрос */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">
            {currentQ.dishCategory}
          </span>
        </div>

        <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
          {currentQ.question}
        </h2>

        {/* Варианты ответов */}
        <div className="space-y-2.5 pt-2">
          {currentQ.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = idx === currentQ.correctIndex;

            let btnStyle = "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100";
            if (isAnswered) {
              if (isCorrect) {
                btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-900 font-bold";
              } else if (isSelected) {
                btnStyle = "bg-red-50 border-red-500 text-red-900";
              } else {
                btnStyle = "bg-slate-50/50 border-slate-100 text-slate-400 opacity-60";
              }
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelectOption(idx)}
                disabled={isAnswered}
                className={`w-full p-4 rounded-2xl border text-xs sm:text-sm text-left transition-all flex items-center justify-between gap-3 ${btnStyle}`}
              >
                <span>{opt}</span>
                {isAnswered && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                {isAnswered && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Пояснение */}
        {isAnswered && (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 leading-relaxed animate-in fade-in duration-150">
            <span className="font-bold text-slate-900">Пояснение:</span> {currentQ.explanation}
          </div>
        )}

        {/* Кнопка Далее */}
        {isAnswered && currentIndex < totalQuestions - 1 && (
          <button
            onClick={handleNext}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
          >
            <span>Следующий вопрос</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {isSubmitting && (
          <div className="py-3 text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Сохранение результатов...</span>
          </div>
        )}
      </div>
    </div>
  );
}
