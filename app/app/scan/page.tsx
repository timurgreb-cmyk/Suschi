"use client";

import { useEffect, useState } from "react";
// Используем динамический импорт для QrReader, так как он не поддерживает SSR
import dynamic from "next/dynamic";
import { processQRScan } from "@/app/actions/time-records";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

// @ts-ignore
const QrReader = dynamic(() => import("react-qr-scanner"), { ssr: false });

type ScanStatus = "idle" | "scanning" | "processing" | "success" | "error";

export default function ScanPage() {
  const [status, setStatus] = useState<ScanStatus>("scanning");
  const [message, setMessage] = useState<string>("");
  const [resultData, setResultData] = useState<{
    type: string;
    location: string;
    isLate?: boolean;
    lateMinutes?: number;
    calculatedFine?: number;
    planStart?: string;
    isCashier?: boolean;
  } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Камера будет запускаться только по кнопке, 
  // чтобы iOS Safari не запрашивал разрешение при каждом открытии приложения

  const handleScan = async (data: any) => {
    if (data && data.text && status === "scanning") {
      setStatus("processing");
      setCameraActive(false);
      
      const clientTimeIso = new Date().toISOString();
      const result = await processQRScan(data.text, clientTimeIso);
      
      if (result.success && result.data) {
        setStatus("success");
        setResultData({
          type: result.data.type,
          location: result.data.locationName,
          isLate: result.data.isLate,
          lateMinutes: result.data.lateMinutes,
          calculatedFine: result.data.calculatedFine,
          planStart: result.data.planStart,
          isCashier: result.data.isCashier
        });
        setMessage(result.data.message || (result.data.type === "check_in" ? "Приход успешно отмечен!" : "Уход успешно отмечен!"));
      } else {
        setStatus("error");
        setMessage(result.error || "Ошибка сканирования");
      }

      setTimeout(() => {
        setStatus("scanning");
        setMessage("");
        setResultData(null);
      }, 5000);
    }
  };

  const handleError = (err: any) => {
    console.error("Camera Error:", err);
    setCameraActive(false);
    const errorMessage = err?.message || JSON.stringify(err);
    setStatus("error");
    if (errorMessage.includes("Permission") || errorMessage.includes("NotAllowedError")) {
      setMessage("Доступ к камере запрещен. Пожалуйста, разрешите использование камеры в настройках браузера.");
    } else {
      setMessage(`Ошибка камеры: ${errorMessage}. Попробуйте нажать кнопку запуска ниже.`);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] relative bg-black overflow-hidden">
      {/* Камера */}
      <div className="flex-1 w-full relative bg-gray-900">
        {cameraActive && status === "scanning" && (() => {
          const Scanner = QrReader as any;
          return (
            <Scanner
              delay={300}
              style={{ height: "100%", width: "100%", objectFit: "cover" }}
              onError={handleError}
              onScan={handleScan}
              constraints={{
                video: { 
                  facingMode: "environment",
                  width: { ideal: 1280 },
                  height: { ideal: 720 }
                }
              }}
            />
          );
        })()}

        {/* Кнопка ручного запуска если камера не активна */}
        {!cameraActive && status === "scanning" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-gray-900">
            <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-6">
              <div className="w-12 h-12 border-4 border-primary rounded-xl flex items-center justify-center relative">
                <div className="w-6 h-1 bg-primary absolute top-1/2 -translate-y-1/2" />
              </div>
            </div>
            <h3 className="text-white text-xl font-bold mb-2">Готовы отметиться?</h3>
            <p className="text-gray-400 text-sm mb-10 max-w-[250px]">Нажмите кнопку ниже, чтобы включить сканер QR-кодов</p>
            <button 
              onClick={() => setCameraActive(true)}
              className="bg-primary text-white w-full max-w-[280px] py-4 rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(37,99,235,0.4)] active:scale-95 transition-all"
            >
              Включить сканер
            </button>
          </div>
        )}
        
        {/* Затемнение и рамка при сканировании */}
        {status === "scanning" && cameraActive && (
          <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center bg-black/20">
            <div className="w-64 h-64 relative mb-12">
              <div className="absolute inset-0 border-2 border-white/20 rounded-3xl" />
              <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-3xl" />
              <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-3xl" />
              <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-3xl" />
              <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-3xl" />
              <div className="absolute top-0 left-0 w-full h-[2px] bg-primary/80 shadow-[0_0_15px_rgba(37,99,235,1)] rounded-full animate-[scan_2s_ease-in-out_infinite]" />
            </div>
            <div className="bg-black/40 backdrop-blur-md border border-white/10 text-white font-medium px-6 py-3 rounded-2xl shadow-xl">
              Наведите на QR-код
            </div>
          </div>
        )}

        {/* Оверлеи состояний (Processing, Success, Error) - оставить без изменений */}
        {status === "processing" && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-20 flex flex-col items-center justify-center">
            <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
              <p className="text-gray-900 font-bold">Обработка...</p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-20 flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl flex flex-col items-center">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-500/30">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">{message}</h2>
               {resultData && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 w-full mb-4">
                  <p className="text-sm text-gray-500 font-medium mb-1">Локация</p>
                  <p className="text-gray-900 font-bold">{resultData.location}</p>
                </div>
              )}
              {resultData && resultData.isLate && resultData.calculatedFine && resultData.calculatedFine > 0 ? (
                <div className="bg-red-50 border border-red-100 rounded-2xl py-4 px-4 w-full mb-8 text-left">
                  <p className="text-xs text-red-500 font-black uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>⚠️ Обнаружено опоздание</span>
                    {resultData.isCashier && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        💰 Кассир (10:45)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-700 font-medium">
                    План начала: <span className="font-bold text-gray-900">{resultData.planStart || (resultData.isCashier ? "10:45" : "11:00")}</span><br/>
                    Вы опоздали на <span className="font-bold text-red-600">{resultData.lateMinutes} мин</span>.<br/>
                    Начислен штраф: <span className="font-bold text-red-600">{resultData.calculatedFine} ₸</span> (ожидает решения администратора).
                  </p>
                </div>
              ) : null}
              <button 
                onClick={() => setStatus("scanning")}
                className="w-full bg-green-500 text-white px-8 py-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-all"
              >
                Готово
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-20 flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl flex flex-col items-center">
              <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-red-500/30">
                <XCircle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Ошибка</h2>
              <p className="text-gray-500 font-medium mb-8">{message}</p>
              <button 
                onClick={() => setStatus("scanning")}
                className="w-full bg-red-500 text-white px-8 py-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-all"
              >
                Попробовать снова
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
