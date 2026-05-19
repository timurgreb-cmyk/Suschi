"use client";

import { loginWithPin, login } from "@/app/actions/auth";
import { useState, useEffect } from "react";
import { Lock, Delete } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"pin" | "admin">("pin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === "pin" && pin.length === 5) {
      handlePinLogin(pin);
    }
  }, [pin, mode]);

  const handlePinLogin = async (currentPin: string) => {
    setLoading(true);
    setErrorMsg(null);
    const result = await loginWithPin(currentPin);
    if (result?.error) {
      setErrorMsg(result.error);
      setPin("");
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    
    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    
    const result = await login(formData);
    
    if (result?.error) {
      setErrorMsg(result.error);
      setLoading(false);
    }
  };

  const handleNumberClick = (num: number) => {
    if (pin.length < 5 && !loading) {
      setPin(prev => prev + num);
      setErrorMsg(null);
    }
  };

  const handleDelete = () => {
    if (pin.length > 0 && !loading) {
      setPin(prev => prev.slice(0, -1));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm flex flex-col items-center">
        
        <div className="mb-8 flex flex-col items-center">
          <div className="h-16 w-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Sushi Control</h2>
          <p className="text-sm text-gray-500 mt-1">
            {mode === "pin" ? "Введите ваш PIN-код" : "Вход для администратора"}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 w-full bg-red-50 text-red-500 px-4 py-3 rounded-xl text-sm text-center animate-shake border border-red-100">
            {errorMsg}
          </div>
        )}

        {mode === "pin" ? (
          <>
            {/* PIN Indicators */}
            <div className="flex space-x-4 mb-12">
              {[0, 1, 2, 3, 4].map((index) => (
                <div 
                  key={index} 
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    index < pin.length 
                      ? "bg-primary scale-110" 
                      : "bg-gray-300 scale-100"
                  }`} 
                />
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-x-6 gap-y-6 w-full max-w-[280px] select-none touch-manipulation">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleNumberClick(num)}
                  disabled={loading}
                  className="w-full aspect-square flex items-center justify-center text-3xl font-medium text-gray-900 bg-white rounded-full shadow-sm active:bg-gray-200 active:scale-90 transition-all cursor-pointer"
                >
                  {num}
                </button>
              ))}
              <div className="w-full aspect-square" />
              <button
                type="button"
                onClick={() => handleNumberClick(0)}
                disabled={loading}
                className="w-full aspect-square flex items-center justify-center text-3xl font-medium text-gray-900 bg-white rounded-full shadow-sm active:bg-gray-200 active:scale-90 transition-all cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="w-full aspect-square flex items-center justify-center text-gray-400 bg-transparent rounded-full active:bg-gray-100 transition-colors cursor-pointer"
              >
                <Delete className="w-8 h-8" />
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleAdminLogin} className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white p-4 rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? "Вход..." : "Войти в панель"}
            </button>
          </form>
        )}

        <button
          onClick={() => {
            setMode(mode === "pin" ? "admin" : "pin");
            setErrorMsg(null);
            setPin("");
          }}
          className="mt-12 text-sm font-bold text-gray-400 hover:text-primary transition-colors py-2 px-4 rounded-xl"
        >
          {mode === "pin" ? "Вход для администратора" : "Вернуться к PIN-коду"}
        </button>
      </div>
    </div>
  );
}
