import crypto from "crypto";

export interface IikoEmployee {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  code?: string;
  mainRoleCode?: string;
  isDeleted?: boolean;
}

export interface IikoAttendanceShift {
  id: string;
  employeeId: string;
  employeeName?: string;
  departmentId?: string;
  departmentName?: string;
  terminalGroupId?: string;
  organizationId?: string;
  sessionStart: string; // ISO
  sessionEnd?: string | null; // ISO
  regularMinutes?: number;
  overtimeMinutes?: number;
}

export interface IikoWaiterTipRecord {
  date: string;
  waiterName: string;
  increaseSum: number; // 10% надбавка за обслуживание
  waiterBonus: number; // 50% от суммы надбавки (к выплате официанту)
  dishSum: number; // Сумма выручки
}

// In-memory token cache to protect iiko license slots
let cachedRestoToken: { token: string; expiresAt: number } | null = null;

function sha1(str: string): string {
  return crypto.createHash("sha1").update(str).digest("hex");
}

export function cleanServerBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export const IIKO_DEFAULT_DEPARTMENT_ID = process.env.IIKO_DEFAULT_DEPARTMENT_ID || "00000000-0000-0000-0000-000000000000";
export const IIKO_DEFAULT_DEPARTMENT_NAME = process.env.IIKO_DEPARTMENT || "Sushi City";
export const IIKO_DEFAULT_ATTENDANCE_TYPE_ID = "1410aeda-5f73-f9da-f415-fc0d9513d400"; // Р (Отработано)
export const IIKO_DEFAULT_ATTENDANCE_CODE = "Р";

/**
 * 1. Авторизация в iikoServer REST API:
 * GET/POST https://host:port/resto/api/auth?login=[login]&pass=[sha1passwordhash]
 */
export async function getIikoRestoToken(): Promise<string> {
  const rawUrl = process.env.IIKO_SERVER_URL || "https://sushi-siti-almaty.iiko.it/resto";
  const serverUrl = cleanServerBaseUrl(rawUrl);
  const login = (process.env.IIKO_LOGIN || "buh").trim();
  const pass = (process.env.IIKO_PASS || "123").trim();
  const apiKey = (process.env.IIKO_API_KEY || "8f8za9u25").trim();

  const now = Date.now();
  if (cachedRestoToken && cachedRestoToken.expiresAt > now + 60000) {
    return cachedRestoToken.token;
  }

  const passHash = sha1(pass);
  const candidates = [
    { label: "SHA1(password)", val: passHash },
    { label: "Plain password", val: pass },
    { label: "SHA1(apiKey)", val: sha1(apiKey) },
  ];

  let lastError = "";

  for (const candidate of candidates) {
    // 1. Попытка GET запроса
    try {
      const url = `${serverUrl}/api/auth?login=${encodeURIComponent(login)}&pass=${encodeURIComponent(candidate.val)}`;
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      const text = await res.text();

      if (res.ok) {
        const cleanToken = text.replace(/["\r\n\s]/g, "").trim();
        if (cleanToken && cleanToken.length >= 8 && !cleanToken.includes("<") && !cleanToken.toLowerCase().includes("error")) {
          cachedRestoToken = {
            token: cleanToken,
            expiresAt: now + 40 * 60 * 1000,
          };
          return cleanToken;
        }
      } else {
        lastError = `[GET ${res.status}]: ${text.slice(0, 150)}`;
      }
    } catch (err: any) {
      lastError = err.message;
    }

    // 2. Попытка POST запроса (form-urlencoded)
    try {
      const authUrl = `${serverUrl}/api/auth`;
      const formBody = new URLSearchParams();
      formBody.append("login", login);
      formBody.append("pass", candidate.val);

      const res = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody.toString(),
        cache: "no-store",
      });
      const text = await res.text();

      if (res.ok) {
        const cleanToken = text.replace(/["\r\n\s]/g, "").trim();
        if (cleanToken && cleanToken.length >= 8 && !cleanToken.includes("<") && !cleanToken.toLowerCase().includes("error")) {
          cachedRestoToken = {
            token: cleanToken,
            expiresAt: now + 40 * 60 * 1000,
          };
          return cleanToken;
        }
      }
    } catch (err: any) {
      lastError = err.message;
    }
  }

  throw new Error(`Ошибка авторизации в iiko: ${lastError}`);
}

/**
 * Вспомогательный парсер XML
 */
function extractXmlTags(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

function extractTagValue(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(xml);
  return match ? match[1].trim() : "";
}

/**
 * 2. Получение списка сотрудников из iiko
 */
export async function getIikoRestoEmployees(): Promise<IikoEmployee[]> {
  const serverUrl = cleanServerBaseUrl(process.env.IIKO_SERVER_URL || "https://fettuccine-co.iiko.it/resto");
  const token = await getIikoRestoToken();

  const url = `${serverUrl}/api/employees?key=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/xml, text/xml, */*",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401 || res.status === 403) {
      cachedRestoToken = null;
    }
    throw new Error(`Ошибка получения сотрудников [${res.status}]: ${errText.slice(0, 150)}`);
  }

  const xml = await res.text();
  const empBlocks = [
    ...extractXmlTags(xml, "employee"),
    ...extractXmlTags(xml, "employeeDto"),
  ];

  return empBlocks.map((block) => {
    const id = extractTagValue(block, "id");
    const name = extractTagValue(block, "name");
    const firstName = extractTagValue(block, "firstName") || name.split(" ")[1] || name;
    const lastName = extractTagValue(block, "lastName") || name.split(" ")[0] || "";
    const phone = extractTagValue(block, "cellPhone") || extractTagValue(block, "phone");
    const code = extractTagValue(block, "code");
    const mainRoleCode = extractTagValue(block, "mainRoleCode") || extractTagValue(block, "role");
    const deleted = extractTagValue(block, "deleted") === "true";

    return {
      id,
      firstName,
      lastName,
      phone,
      code,
      mainRoleCode,
      isDeleted: deleted,
    };
  }).filter(emp => !emp.isDeleted);
}

/**
 * Форматирование ISO даты под часовой пояс Алматы (+05:00) для iiko XML
 */
export function formatIikoDate(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const almatyTime = new Date(utc + (5 * 3600000));

  const yyyy = almatyTime.getFullYear();
  const mm = String(almatyTime.getMonth() + 1).padStart(2, "0");
  const dd = String(almatyTime.getDate()).padStart(2, "0");
  const hh = String(almatyTime.getHours()).padStart(2, "0");
  const min = String(almatyTime.getMinutes()).padStart(2, "0");
  const ss = String(almatyTime.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+05:00`;
}

/**
 * 3. Создание явки в iiko
 */
export async function createIikoRestoAttendance({
  employeeIikoId,
  dateFrom,
  dateTo,
  departmentId = IIKO_DEFAULT_DEPARTMENT_ID,
  departmentName = IIKO_DEFAULT_DEPARTMENT_NAME,
  attendanceTypeId = IIKO_DEFAULT_ATTENDANCE_TYPE_ID,
  attendanceTypeCode = IIKO_DEFAULT_ATTENDANCE_CODE,
  comment = "",
}: {
  employeeIikoId: string;
  dateFrom: string | Date;
  dateTo: string | Date;
  departmentId?: string;
  departmentName?: string;
  attendanceTypeId?: string;
  attendanceTypeCode?: string;
  comment?: string;
}): Promise<{ success: boolean; id?: string; error?: string; raw?: string }> {
  try {
    const serverUrl = cleanServerBaseUrl(process.env.IIKO_SERVER_URL || "https://fettuccine-co.iiko.it/resto");
    const token = await getIikoRestoToken();

    const formattedFrom = formatIikoDate(dateFrom);
    const formattedTo = formatIikoDate(dateTo);

    const xmlPayload = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<attendance>
  <employeeId>${employeeIikoId}</employeeId>
  <departmentId>${departmentId}</departmentId>
  <departmentName>${departmentName}</departmentName>
  <dateFrom>${formattedFrom}</dateFrom>
  <dateTo>${formattedTo}</dateTo>
  <attendanceType>${attendanceTypeCode}</attendanceType>
  <attendanceTypeId>${attendanceTypeId}</attendanceTypeId>
  <comment>${comment}</comment>
</attendance>`;

    const res = await fetch(`${serverUrl}/api/employees/attendance/create?key=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
        "Accept": "application/xml, text/xml, */*",
      },
      body: xmlPayload,
      cache: "no-store",
    });

    const text = await res.text();

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) cachedRestoToken = null;
      return { success: false, error: `[iiko ${res.status}]: ${text}` };
    }

    const createdId = extractTagValue(text, "id");
    return { success: true, id: createdId, raw: text };
  } catch (err: any) {
    return { success: false, error: err.message || "Ошибка отправки явки в iiko" };
  }
}

/**
 * 4. Получение явок сотрудников из iiko
 */
export async function getIikoRestoAttendance(dateFrom: string, dateTo?: string): Promise<IikoAttendanceShift[]> {
  const serverUrl = cleanServerBaseUrl(process.env.IIKO_SERVER_URL || "https://fettuccine-co.iiko.it/resto");
  const token = await getIikoRestoToken();

  const to = dateTo || dateFrom;
  const url = `${serverUrl}/api/employees/attendance?from=${dateFrom}&to=${to}&withPaymentDetails=true&key=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/xml, text/xml, */*",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401 || res.status === 403) {
      cachedRestoToken = null;
    }
    throw new Error(`Ошибка получения явок [${res.status}]: ${errText.slice(0, 150)}`);
  }

  const xml = await res.text();
  const attendanceBlocks = [
    ...extractXmlTags(xml, "attendance"),
    ...extractXmlTags(xml, "attendanceDto"),
  ];

  return attendanceBlocks.map((block) => {
    const id = extractTagValue(block, "id");
    const employeeId = extractTagValue(block, "employeeId") || extractTagValue(block, "userId");
    const dateFromXml = extractTagValue(block, "dateFrom") || extractTagValue(block, "personalDateFrom") || extractTagValue(block, "created");
    const dateToXml = extractTagValue(block, "dateTo") || extractTagValue(block, "personalDateTo");
    const departmentId = extractTagValue(block, "departmentId");
    const departmentName = extractTagValue(block, "departmentName");
    const regularMinutesStr = extractTagValue(block, "regularPayedMinutes");
    const overtimeMinutesStr = extractTagValue(block, "overtimePayedMinutes");

    return {
      id,
      employeeId,
      departmentId: departmentId || undefined,
      departmentName: departmentName || undefined,
      sessionStart: dateFromXml,
      sessionEnd: dateToXml || null,
      regularMinutes: regularMinutesStr ? parseInt(regularMinutesStr, 10) : undefined,
      overtimeMinutes: overtimeMinutesStr ? parseInt(overtimeMinutesStr, 10) : undefined,
    };
  });
}

/**
 * 5. Получение процентов официантов (50% от 10% надбавки IncreaseSum) через OLAP отчет iiko
 */
export async function getIikoWaiterServiceTips({
  dateFrom,
  dateTo,
}: {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
}): Promise<{
  daily: IikoWaiterTipRecord[];
  totalsByWaiter: Record<string, { increaseSum: number; waiterBonus: number; dishSum: number }>;
}> {
  try {
    const serverUrl = cleanServerBaseUrl(process.env.IIKO_SERVER_URL || "https://fettuccine-co.iiko.it/resto");
    const token = await getIikoRestoToken();

    // В OLAP iiko фильтр DateRange по полю OpenDate.Typed исключает дату `to` (to интерпретируется как T00:00:00).
    // Чтобы включить весь день dateTo, прибавляем 1 день к границе запроса в iiko.
    let queryDateTo = dateTo;
    try {
      const [y, m, d] = dateTo.split("-").map(Number);
      if (y && m && d) {
        const nextDay = new Date(Date.UTC(y, m - 1, d + 1));
        queryDateTo = nextDay.toISOString().split("T")[0];
      }
    } catch {
      queryDateTo = dateTo;
    }

    const query = {
      reportType: "SALES",
      groupByRowFields: ["OpenDate.Typed", "WaiterName"],
      aggregateFields: ["IncreaseSum", "DishSumInt"],
      filters: {
        "OpenDate.Typed": {
          filterType: "DateRange",
          periodType: "CUSTOM",
          from: dateFrom,
          to: queryDateTo,
        },
      },
    };

    const res = await fetch(`${serverUrl}/api/v2/reports/olap?key=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) cachedRestoToken = null;
      console.warn("OLAP Waiter tips error status:", res.status);
      return { daily: [], totalsByWaiter: {} };
    }

    const json = await res.json();
    const rows = json?.data || [];

    const daily: IikoWaiterTipRecord[] = [];
    const totalsByWaiter: Record<string, { increaseSum: number; waiterBonus: number; dishSum: number }> = {};

    for (const row of rows) {
      const date = row["OpenDate.Typed"] || "";
      // Фильтруем даты, чтобы не захватить лишнее при расширении границы
      if (date && (date < dateFrom || date > dateTo)) continue;

      const waiterName = row["WaiterName"] || "Неизвестно";
      const increaseSum = Math.round(Number(row["IncreaseSum"]) || 0);
      const dishSum = Math.round(Number(row["DishSumInt"]) || 0);
      // Формула: 50% от суммы 10% надбавки iiko
      const waiterBonus = Math.round(increaseSum / 2);

      daily.push({
        date,
        waiterName,
        increaseSum,
        waiterBonus,
        dishSum,
      });

      if (!totalsByWaiter[waiterName]) {
        totalsByWaiter[waiterName] = { increaseSum: 0, waiterBonus: 0, dishSum: 0 };
      }
      totalsByWaiter[waiterName].increaseSum += increaseSum;
      totalsByWaiter[waiterName].waiterBonus += waiterBonus;
      totalsByWaiter[waiterName].dishSum += dishSum;
    }

    return { daily, totalsByWaiter };
  } catch (err: any) {
    console.error("getIikoWaiterServiceTips error:", err);
    return { daily: [], totalsByWaiter: {} };
  }
}

/**
 * Унифицированные методы
 */
export async function getIikoOrganizations(): Promise<any[]> {
  return [{ id: IIKO_DEFAULT_DEPARTMENT_ID, name: IIKO_DEFAULT_DEPARTMENT_NAME }];
}

export async function getIikoEmployees(orgIds?: string[]): Promise<IikoEmployee[]> {
  return getIikoRestoEmployees();
}

export async function getIikoAttendanceShifts(
  orgIds: string[],
  dateFrom: string,
  dateTo?: string
): Promise<IikoAttendanceShift[]> {
  return getIikoRestoAttendance(dateFrom, dateTo);
}
