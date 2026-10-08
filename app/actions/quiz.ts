"use server";

import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { generate30QuestionsFromRecipes, QuizQuestion } from "@/utils/iiko/quiz-generator";
import { revalidatePath } from "next/cache";

export interface QuizAttemptResult {
  score: number;
  totalQuestions: number;
  grade: number; // 2, 3, 4, 5
  percentage: number;
  passed: boolean;
  gradeLabel: string;
  weekNumber: number;
  year: number;
  completedAt: string;
}

export interface WeeklyQuizStatus {
  isPassedThisWeek: boolean;
  currentWeekNumber: number;
  year: number;
  lastAttempt: QuizAttemptResult | null;
  bestAttemptThisWeek: QuizAttemptResult | null;
}

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getISOWeekNumber(date: Date = new Date()): { week: number; year: number } {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return { week, year: target.getFullYear() };
}

function calculateGrade(score: number, total = 30): { grade: number; label: string; passed: boolean } {
  if (score >= 28) return { grade: 5, label: "Отлично (5)", passed: true };
  if (score >= 24) return { grade: 4, label: "Хорошо (4)", passed: true };
  if (score >= 18) return { grade: 3, label: "Удовлетворительно (3)", passed: false };
  return { grade: 2, label: "Не сдал (2)", passed: false };
}

/**
 * 1. Получить статус аттестации текущего сотрудника за эту неделю
 */
export async function getWeeklyQuizStatus(): Promise<WeeklyQuizStatus> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { week, year } = getISOWeekNumber();

  if (!user) {
    return {
      isPassedThisWeek: false,
      currentWeekNumber: week,
      year,
      lastAttempt: null,
      bestAttemptThisWeek: null,
    };
  }

  const adminClient = getAdminClient();

  const { data: submissions } = await adminClient
    .from("checklist_submissions")
    .select("*")
    .eq("employee_id", user.id)
    .order("completed_at", { ascending: false });

  if (!submissions || submissions.length === 0) {
    return {
      isPassedThisWeek: false,
      currentWeekNumber: week,
      year,
      lastAttempt: null,
      bestAttemptThisWeek: null,
    };
  }

  const quizSubmissions = submissions.filter((s) => s.notes && s.notes.includes("Аттестация ТТК iiko"));

  let lastAttempt: QuizAttemptResult | null = null;
  let bestAttemptThisWeek: QuizAttemptResult | null = null;
  let isPassedThisWeek = false;

  for (const sub of quizSubmissions) {
    try {
      const match = sub.notes.match(/Результат:\s*(\d+)\/(\d+)/);
      if (match) {
        const score = parseInt(match[1], 10);
        const total = parseInt(match[2], 10) || 30;
        const subDate = new Date(sub.completed_at || sub.created_at);
        const subWeek = getISOWeekNumber(subDate);
        const { grade, label, passed } = calculateGrade(score, total);

        const attempt: QuizAttemptResult = {
          score,
          totalQuestions: total,
          grade,
          gradeLabel: label,
          percentage: Math.round((score / total) * 100),
          passed,
          weekNumber: subWeek.week,
          year: subWeek.year,
          completedAt: sub.completed_at || sub.created_at,
        };

        if (!lastAttempt) {
          lastAttempt = attempt;
        }

        if (subWeek.week === week && subWeek.year === year) {
          if (!bestAttemptThisWeek || attempt.score > bestAttemptThisWeek.score) {
            bestAttemptThisWeek = attempt;
          }
          if (attempt.passed) {
            isPassedThisWeek = true;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    isPassedThisWeek,
    currentWeekNumber: week,
    year,
    lastAttempt,
    bestAttemptThisWeek,
  };
}

/**
 * 2. Сгенерировать новый набор из 30 вопросов по меню iiko
 */
export async function getFreshQuizQuestions(): Promise<{ success: boolean; questions: QuizQuestion[]; error?: string }> {
  try {
    const questions = await generate30QuestionsFromRecipes();
    return { success: true, questions };
  } catch (err: any) {
    return { success: false, questions: [], error: err.message || "Ошибка генерации вопросов" };
  }
}

export async function getQuizQuestions(): Promise<{ success: boolean; questions: QuizQuestion[]; error?: string }> {
  return getFreshQuizQuestions();
}

/**
 * 3. Сохранить результат сдачи аттестации
 */
export async function submitQuizAttempt(payload: {
  score: number;
  totalQuestions: number;
  answers: Record<string, number>;
}): Promise<{ success: boolean; result: QuizAttemptResult; error?: string }> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Требуется авторизация", result: {} as any };
    }

    const adminClient = getAdminClient();
    const { week, year } = getISOWeekNumber();
    const { score, totalQuestions } = payload;
    const { grade, label, passed } = calculateGrade(score, totalQuestions);

    const nowIso = new Date().toISOString();

    await adminClient.from("checklist_submissions").insert({
      employee_id: user.id,
      shift_date: nowIso.split("T")[0],
      status: passed ? "approved" : "rejected",
      notes: `Аттестация ТТК iiko: Неделя ${week}/${year}. Результат: ${score}/${totalQuestions} (${label})`,
      completed_at: nowIso,
    });

    const result: QuizAttemptResult = {
      score,
      totalQuestions,
      grade,
      gradeLabel: label,
      percentage: Math.round((score / totalQuestions) * 100),
      passed,
      weekNumber: week,
      year,
      completedAt: nowIso,
    };

    revalidatePath("/app/kitchen/quiz");
    revalidatePath("/app/kitchen");

    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err.message, result: {} as any };
  }
}
