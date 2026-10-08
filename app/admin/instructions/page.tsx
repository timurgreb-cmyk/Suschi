"use client";

import { useState } from "react";
import { 
  BookOpen, 
  Smartphone, 
  Settings, 
  Users, 
  CheckCircle2, 
  Download, 
  QrCode, 
  Wallet, 
  Clock,
  Sparkles
} from "lucide-react";

export default function InstructionsPage() {
  const [activeTab, setActiveTab] = useState<"iiko" | "pwa" | "cashiers" | "fines">("iiko");

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      
      {/* Шапка */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              База знаний и инструкции Sushi Control
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Инструкции по настройке iiko, смене кассиров (10:45), штрафам и PWA
            </p>
          </div>
        </div>

        {/* Переключатель вкладок */}
        <div className="flex flex-wrap gap-2 pt-6 border-t border-gray-100 mt-6">
          <button
            onClick={() => setActiveTab("iiko")}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === "iiko"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "bg-gray-100 text-gray-600 hover:text-gray-900"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>1. Подключение iiko</span>
          </button>

          <button
            onClick={() => setActiveTab("cashiers")}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === "cashiers"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "bg-gray-100 text-gray-600 hover:text-gray-900"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>2. График кассиров (10:45)</span>
          </button>

          <button
            onClick={() => setActiveTab("fines")}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === "fines"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "bg-gray-100 text-gray-600 hover:text-gray-900"
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>3. Штрафы и Сброс</span>
          </button>

          <button
            onClick={() => setActiveTab("pwa")}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === "pwa"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "bg-gray-100 text-gray-600 hover:text-gray-900"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>4. Установка PWA</span>
          </button>
        </div>
      </div>

      {/* Контент вкладок */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-200 space-y-6">
        {activeTab === "iiko" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>Параметры подключения к серверу iiko</span>
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Для синхронизации с базой iiko ресторана добавьте следующие переменные в файл <code>.env.local</code> (или в Environment Variables на Vercel):
            </p>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-2xl text-xs font-mono overflow-x-auto">
              <p>IIKO_SERVER_URL=https://sushi-control.iiko.it/resto</p>
              <p>IIKO_LOGIN=admin</p>
              <p>IIKO_PASS=ваш_пароль</p>
              <p>IIKO_API_KEY=ваш_api_ключ</p>
              <p>IIKO_DEFAULT_DEPARTMENT_NAME=Sushi Control</p>
            </div>
            <p className="text-xs text-gray-500">
              После добавления перейдите в раздел «Финансы → iiko Синхронизация» и нажмите «Проверить соединение».
            </p>
          </div>
        )}

        {activeTab === "cashiers" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">График кассиров (начало смены в 10:45)</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              В Sushi Control кассиры должны открывать смену в <strong>10:45</strong> (на 15 минут раньше стандартного открытия в 11:00).
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
              <li>При создании или редактировании сотрудника включите галочку <strong>«💰 Кассир»</strong>.</li>
              <li>Если кассир отмечается позже 10:45 (+ 10 мин льготного периода = 10:55), система рассчитывает штраф за опоздание.</li>
              <li>В разделе «Штрафы» и «Табель» для кассиров автоматически отображается бейдж <code>💰 10:45</code>.</li>
            </ul>
          </div>
        )}

        {activeTab === "fines" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Штрафы за опоздания и Полный сброс</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Система автоматически фиксирует факт опоздания при сканировании QR-кода и направляет его в раздел <strong>Штрафы</strong>.
            </p>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
              <li><strong>Подтверждение / Списание</strong>: Администратор может одобрить штраф, изменить сумму или отменить его.</li>
              <li><strong>Кнопка полного сброса</strong>: В Журнале, Штрафах и Табеле доступны кнопки сброса с двойным подтверждением (для тестирования или очистки месяца).</li>
            </ul>
          </div>
        )}

        {activeTab === "pwa" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Установка приложения на телефон сотрудника (PWA)</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              Сотрудники могут установить приложение прямо из браузера без App Store и Google Play:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <h3 className="font-bold text-gray-900 text-sm mb-1">iOS (Safari / iPhone)</h3>
                <p className="text-xs text-gray-600">Откройте сайт в Safari → Нажмите кнопку «Поделиться» → Выберите «На экран Домой».</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <h3 className="font-bold text-gray-900 text-sm mb-1">Android (Chrome)</h3>
                <p className="text-xs text-gray-600">Откройте сайт в Chrome → Нажмите «Установить приложение» во всплывающем баннере.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
