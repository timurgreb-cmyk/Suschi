"use client";

import { useState, useEffect } from "react";

// @ts-ignore
import { QRCodeSVG } from "qrcode.react";

export default function LocationsPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBaseHours, setNewBaseHours] = useState(8);
  const [loading, setLoading] = useState(false);

  const fetchLocations = async () => {
    const res = await fetch("/api/locations", { cache: "no-store" });
    const data = await res.json();
    setLocations(data.locations || []);
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), base_hours: newBaseHours })
    });
    setNewName("");
    setNewBaseHours(8);
    setShowAdd(false);
    setLoading(false);
    fetchLocations();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Локации и QR-коды</h1>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className={`${showAdd ? "bg-gray-200 text-gray-800" : "bg-primary text-white hover:bg-primary/90"} px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm`}
        >
          {showAdd ? "Отмена" : "+ Добавить локацию"}
        </button>
      </div>

      {showAdd && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-bold mb-3">Новая локация</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название (например: Главный вход)"
              className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <input
              type="number"
              value={newBaseHours}
              onChange={(e) => setNewBaseHours(parseFloat(e.target.value))}
              placeholder="Часов в смене"
              step="0.5"
              min="1"
              max="24"
              className="w-32 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <button
              onClick={handleAdd}
              disabled={loading || !newName.trim()}
              className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              {loading ? "Создание..." : "Создать"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto print:border-none print:shadow-none">
          <table className="min-w-full divide-y divide-gray-200 print:hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Часы смены</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {locations.map((loc) => (
                <tr key={loc.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedLocation(loc.id)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {loc.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {loc.base_hours || 8} ч.
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      loc.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>
                      {loc.is_active ? "Активна" : "Отключена"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      className="text-primary hover:text-primary/80"
                      onClick={(e) => { e.stopPropagation(); setSelectedLocation(loc.id); }}
                    >
                      Показать QR
                    </button>
                  </td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Локаций пока нет. Создайте первую!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          {selectedLocation ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col items-center text-center">
              <div id="qr-print-area">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Suschi Control
                </h2>
                <p className="text-lg text-gray-700 mb-2">
                  {locations.find(l => l.id === selectedLocation)?.name}
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Отсканируйте QR-код для отметки
                </p>
                
                <div className="p-4 bg-white border-4 border-gray-100 rounded-2xl shadow-sm mb-4">
                  <QRCodeSVG 
                    value={selectedLocation} 
                    size={400} 
                    level="H" 
                    includeMargin={true}
                  />
                </div>

                <p className="text-xs text-gray-400">suschi.control</p>
              </div>
              
              <div className="flex gap-4 mt-6">
                <button 
                  className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm"
                  onClick={() => window.print()}
                >
                  Распечатать
                </button>
                <button 
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
                  onClick={() => setSelectedLocation(null)}
                >
                  Скрыть
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col items-center justify-center h-full min-h-[400px] text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">📱</span>
              </div>
              <h2 className="text-lg font-medium text-gray-900 mb-1">Выберите локацию</h2>
              <p className="text-gray-500">Нажмите на локацию в списке, чтобы сгенерировать для нее QR-код</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
