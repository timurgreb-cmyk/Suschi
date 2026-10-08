/**
 * Утилиты сопоставления официантов из iiko с профилями сотрудников
 */

export interface WaiterTipRecord {
  date: string;
  waiterName: string;
  increaseSum: number;
  waiterBonus: number;
  dishSum: number;
}

export interface WaiterTipSummary {
  totalBonus: number;
  dailyTips: Record<string, number>;
  matchedWaiterNames: string[];
}

export function levenshteinDistance(s1: string, s2: string): number {
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;
  const matrix: number[][] = Array(s2.length + 1)
    .fill(null)
    .map(() => Array(s1.length + 1).fill(0));

  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[s2.length][s1.length];
}

/**
 * Оценка качества совпадения имени официанта в iiko и сотрудника в БД:
 * 100 - Полное точное совпадение
 * 90  - Точное совпадение слова/имени длиной >= 3 символа (напр. "Пискунова Ульяна" и "Ульяна")
 * 75  - Совпадение префикса имени длиной >= 3 символа (напр. "Алихан" и "Али")
 * 60  - Опечатка (совпадает первая буква, длина слова >= 5, дистанция Левенштейна строго 1, напр. "Абылай" и "Абылый")
 * 0   - Не совпадает
 */
export function calculateMatchScore(waiterName: string, employeeName: string): number {
  const cleanW = (waiterName || "").toLowerCase().trim();
  const cleanEmp = (employeeName || "").toLowerCase().trim();

  if (!cleanW || !cleanEmp) return 0;

  // 1. Полное точное совпадение всей строки
  if (cleanW === cleanEmp) return 100;

  const wTokens = cleanW.split(/\s+/).filter((t) => t.length >= 2);
  const empTokens = cleanEmp.split(/\s+/).filter((t) => t.length >= 2);

  // 2. Точное совпадение отдельного слова (имя или фамилия) длиной >= 3 букв
  for (const ep of empTokens) {
    for (const wp of wTokens) {
      if (ep.length >= 3 && ep === wp) {
        return 90;
      }
    }
  }

  // 3. Подстрока / префикс (например, "Али" и "Алихан", или "Тауекел" в полном имени)
  for (const ep of empTokens) {
    for (const wp of wTokens) {
      if (ep.length >= 3 && wp.length >= 3) {
        if (ep.startsWith(wp) || wp.startsWith(ep)) {
          return 75;
        }
      }
    }
  }

  // 4. Опечатка в POS-системе:
  // ВАЖНО:
  // - Первая буква ОБЯЗАНА совпадать (исключает ложные совпадения "Марина" <-> "Амина", "Марина" <-> "Карина" и т.д.)
  // - Длина обоих слов должна быть не менее 5 символов
  // - Расстояние Левенштейна СТРОГО <= 1 (дистанция 2 меняет до 40% короткого имени и недопустима)
  for (const ep of empTokens) {
    for (const wp of wTokens) {
      if (ep.length >= 5 && wp.length >= 5 && ep[0] === wp[0]) {
        const dist = levenshteinDistance(ep, wp);
        if (dist === 1) {
          return 60;
        }
      }
    }
  }

  return 0;
}

/**
 * Проверка, принадлежит ли запись официанта из iiko конкретному сотруднику,
 * с учетом защиты от коллизий с другими сотрудниками ресторана.
 */
export function isWaiterMatchedToEmployee(
  waiterName: string,
  employeeName: string,
  allEmployees: Array<{ full_name: string }> = []
): boolean {
  const score = calculateMatchScore(waiterName, employeeName);
  if (score === 0) return false;

  // Если передан список всех сотрудников, проверяем нет ли другого сотрудника
  // с более точным совпадением
  for (const other of allEmployees) {
    if (other.full_name === employeeName) continue;
    const otherScore = calculateMatchScore(waiterName, other.full_name);

    // Другой сотрудник подходит строго лучше
    if (otherScore > score) {
      return false;
    }

    // Если у другого сотрудника точное совпадение (>= 90), а у текущего только префикс или опечатка (< 90)
    if (otherScore >= 90 && score < 90) {
      return false;
    }
  }

  return true;
}

/**
 * Универсальный поиск чаевых и бонусов официанта за период
 */
export function findMatchingWaiterTips(
  empName: string,
  tipsData: {
    daily: WaiterTipRecord[];
    totalsByWaiter: Record<string, { increaseSum: number; waiterBonus: number; dishSum: number }>;
  },
  allEmployees: Array<{ full_name: string }> = []
): WaiterTipSummary {
  if (!empName) {
    return { totalBonus: 0, dailyTips: {}, matchedWaiterNames: [] };
  }

  const waiterNames = Object.keys(tipsData.totalsByWaiter || {});
  const matchedWaiterNames = waiterNames.filter((wName) =>
    isWaiterMatchedToEmployee(wName, empName, allEmployees)
  );

  if (matchedWaiterNames.length === 0) {
    return { totalBonus: 0, dailyTips: {}, matchedWaiterNames: [] };
  }

  const matchingSet = new Set(matchedWaiterNames.map((n) => n.toLowerCase().trim()));

  const matchedDaily = (tipsData.daily || []).filter((r) =>
    matchingSet.has((r.waiterName || "").toLowerCase().trim())
  );

  let totalBonus = 0;
  const dailyTips: Record<string, number> = {};

  matchedDaily.forEach((row) => {
    totalBonus += row.waiterBonus;
    if (row.date) {
      dailyTips[row.date] = (dailyTips[row.date] || 0) + row.waiterBonus;
    }
  });

  if (totalBonus === 0) {
    matchedWaiterNames.forEach((wName) => {
      totalBonus += tipsData.totalsByWaiter[wName]?.waiterBonus || 0;
    });
  }

  return { totalBonus, dailyTips, matchedWaiterNames };
}
