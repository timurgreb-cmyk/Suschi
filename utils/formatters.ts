/**
 * Утилиты форматирования имен, должностей и сумм
 */

/**
 * Очистка и дедупликация имени (например "Тимур Тимур" -> "Тимур")
 */
export function formatDisplayName(fullName?: string | null): string {
  if (!fullName) return "Сотрудник";
  const clean = fullName.trim();
  const parts = clean.split(/\s+/);
  
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0];
  }
  
  return clean;
}

/**
 * Преобразование системных кодов должностей iiko в человекочитаемые названия для заявлений и интерфейса
 */
export function formatPositionName(rawPosition?: string | null, grammaticalCase: "nominative" | "genitive" = "nominative"): string {
  if (!rawPosition) {
    return grammaticalCase === "genitive" ? "сотрудника" : "Сотрудник";
  }

  const clean = rawPosition.trim().toUpperCase();

  const map: Record<string, { nominative: string; genitive: string }> = {
    BUH1: { nominative: "Бухгалтер", genitive: "бухгалтера" },
    BUH: { nominative: "Бухгалтер", genitive: "бухгалтера" },
    WR1: { nominative: "Официант", genitive: "официанта" },
    WR: { nominative: "Официант", genitive: "официанта" },
    FFC: { nominative: "Сушист / Повар", genitive: "сушиста" },
    COOK: { nominative: "Сушист / Повар", genitive: "сушиста" },
    SUSH: { nominative: "Сушист", genitive: "сушиста" },
    PIZZA: { nominative: "Пиццер", genitive: "пиццера" },
    BR1: { nominative: "Бармен", genitive: "бармена" },
    BR: { nominative: "Бармен", genitive: "бармена" },
    CS1: { nominative: "Кассир", genitive: "кассира" },
    CS: { nominative: "Кассир", genitive: "кассира" },
    MN1: { nominative: "Администратор", genitive: "администратора" },
    MN0: { nominative: "Управляющий", genitive: "управляющего" },
    ADM: { nominative: "Администратор", genitive: "администратора" },
    CO1: { nominative: "Сотрудник", genitive: "сотрудника" },
  };

  if (map[clean]) {
    return map[clean][grammaticalCase];
  }

  // Если должность уже на русском языке
  const lower = rawPosition.toLowerCase();
  if (grammaticalCase === "genitive") {
    if (lower.endsWith("арь") || lower.endsWith("ер") || lower.endsWith("ор") || lower.endsWith("ент") || lower.endsWith("ист") || lower.endsWith("ант")) {
      return lower + "а";
    }
    return lower;
  }

  return rawPosition;
}
