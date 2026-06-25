"use client";

export default function ExportCsvButton({ data, month }: { data: any[], month: string }) {
  const handleExport = () => {
    // Формируем заголовки CSV
    const headers = ["ФИО", "Дата", "Статус", "Приход", "Уход", "Отработано часов", "Переработки", "Ставка за смену (KZT)", "Итого к выплате (KZT)"];
    
    // Формируем строки: для каждого сотрудника выводим его дни
    const rows: any[] = [];
    
    data.forEach(emp => {
      if (emp.dailyDetails.length === 0) {
        rows.push([
          `"${emp.full_name}"`,
          "Нет данных",
          "—",
          "—",
          "—",
          "0",
          "0",
          emp.shift_rate || 0,
          0
        ]);
      } else {
        emp.dailyDetails.forEach((day: any, index: number) => {
          rows.push([
            `"${emp.full_name}"`,
            day.day,
            day.status === 'complete' ? "Отработано" : day.status === 'in_progress' ? "В процессе" : "Ошибка (нет ухода)",
            day.formattedFirstIn || "—",
            day.formattedLastOut || "—",
            day.actualHours ? day.actualHours.toFixed(1) : "0",
            day.overtime ? day.overtime.toFixed(1) : "0",
            index === 0 ? emp.shift_rate || 0 : "", // Показываем ставку только в первой строке для красоты
            index === 0 ? emp.totalEarned : "" // Показываем итог только в первой строке
          ]);
        });
      }
    });
    
    // Объединяем в CSV строку
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");
    
    // Создаем Blob с BOM для правильного отображения кириллицы в Excel
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    // Создаем ссылку для скачивания
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `timesheet_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button 
      onClick={handleExport}
      className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
    >
      Экспорт в CSV
    </button>
  );
}
