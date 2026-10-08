"use client";

import { Loader2 } from "lucide-react";

interface SpinnerProps {
  text?: string;
  size?: "sm" | "md" | "lg" | "fullscreen";
}

export default function Spinner({ text = "Загрузка...", size = "md" }: SpinnerProps) {
  if (size === "fullscreen") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative flex items-center justify-center">
          {/* Пульсирующий неоновый ореол */}
          <div className="absolute w-16 h-16 rounded-full bg-primary/20 animate-ping" />
          <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-xl flex items-center justify-center relative z-10">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          </div>
        </div>
        {text && (
          <p className="mt-4 text-xs font-bold text-gray-500 dark:text-slate-400 tracking-wider uppercase animate-pulse">
            {text}
          </p>
        )}
      </div>
    );
  }

  const iconSizes = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-in fade-in duration-150">
      <div className="relative flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-md flex items-center justify-center">
          <Loader2 className={`${iconSizes[size]} text-primary animate-spin`} />
        </div>
      </div>
      {text && (
        <p className="mt-3 text-xs font-bold text-gray-500 dark:text-slate-400 tracking-wider animate-pulse">
          {text}
        </p>
      )}
    </div>
  );
}
