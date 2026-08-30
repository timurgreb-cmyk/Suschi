"use client";

import { useState } from "react";
import { createEmployee } from "@/app/actions/employees";

export default function AddEmployeeForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData(e.currentTarget);
      const result = await createEmployee(formData);
      
      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        setLoading(false);
        onSuccess();
      }
    } catch (err: any) {
      setError("Непредвиденная ошибка: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
      <h2 className="text-xl font-bold mb-4">Создать сотрудника</h2>
      {error && <div className="mb-4 text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ФИО *</label>
            <input required type="text" name="fullName" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIN-код (5 цифр) *</label>
            <input 
              required 
              type="text" 
              name="pinCode" 
              pattern="\d{5}"
              maxLength={5}
              placeholder="12345"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none font-mono tracking-widest text-lg" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Должность</label>
            <input type="text" name="position" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
            <input type="text" name="phone" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ставка за смену (₸) *</label>
            <input required type="number" step="1" name="shiftRate" defaultValue="0" className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none" />
          </div>
        </div>
        
        <div className="space-y-2 pt-2">
          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="isCashier" 
              name="isCashier" 
              value="true"
              className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary cursor-pointer" 
            />
            <label htmlFor="isCashier" className="text-sm font-medium text-gray-700 cursor-pointer">
              💰 <span className="font-semibold text-gray-900">Кассир</span> (начало рабочего дня в <span className="text-primary font-bold">10:45</span>, штраф при опоздании)
            </label>
          </div>

          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="isOvertimeEnabled" 
              name="isOvertimeEnabled" 
              defaultChecked 
              value="true"
              className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary cursor-pointer" 
            />
            <label htmlFor="isOvertimeEnabled" className="text-sm font-medium text-gray-700 cursor-pointer">
              Начислять переработки (сверх базовых часов локации)
            </label>
          </div>
        </div>
        
        <div className="flex justify-end pt-4">
          <button 
            type="submit" 
            disabled={loading}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? "Создание..." : "Создать"}
          </button>
        </div>
      </form>
    </div>
  );
}
