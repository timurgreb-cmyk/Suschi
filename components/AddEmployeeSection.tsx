"use client";

import { useState } from "react";
import AddEmployeeForm from "./AddEmployeeForm";
import { useRouter } from "next/navigation";

export default function AddEmployeeSection({ 
  iikoEmployees = [],
  allEmployees = []
}: { 
  iikoEmployees?: any[];
  allEmployees?: any[];
}) {
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    setShowForm(false);
    router.refresh();
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Сотрудники</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Управление персоналом, ставками и привязками к iiko</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className={`${showForm ? "bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200" : "bg-primary text-white hover:bg-primary/90"} px-4 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95 shadow-sm`}
        >
          {showForm ? "Отмена" : "+ Добавить сотрудника"}
        </button>
      </div>

      {showForm && (
        <AddEmployeeForm 
          onSuccess={handleSuccess} 
          iikoEmployees={iikoEmployees} 
          allEmployees={allEmployees}
        />
      )}
    </>
  );
}
