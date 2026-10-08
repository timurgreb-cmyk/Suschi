import fs from "fs";
import path from "path";
import { getIikoRestoToken, cleanServerBaseUrl } from "./client";

export interface IikoRecipeIngredient {
  id: string;
  name: string;
  unit: string;
  grossAmount: number;
  netAmount: number;
  formattedGross: string;
  formattedNet: string;
}

export interface IikoRecipe {
  id: string;
  name: string;
  code: string;
  category: string;
  rawCategory: string;
  cookingPlace: string;
  yield: string;
  ingredientsCount: number;
  ingredients: IikoRecipeIngredient[];
  technology?: string;
  appearance?: string;
  organoleptic?: string;
  updatedAt: string;
}

export interface IikoRecipesPayload {
  lastSyncAt: string;
  totalCount: number;
  categories: string[];
  recipes: IikoRecipe[];
}

const CACHE_FILE_PATH = path.join(process.cwd(), "data", "iiko_recipes_sushi_control.json");

function formatAmount(val: any, unit: string): string {
  if (val === undefined || val === null || val === 0) return "—";
  const num = Number(val);
  if (isNaN(num)) return "—";

  const cleanUnit = (unit || "").trim().toLowerCase();

  // Для килограммов и литров: если меньше 1, переводим в граммы/мл
  if (cleanUnit === "кг" || cleanUnit === "л" || !cleanUnit) {
    if (num < 1) {
      const g = Math.round(num * 1000);
      return `${g} ${cleanUnit === "л" ? "мл" : "г"}`;
    }
    return `${Number(num.toFixed(3))} ${cleanUnit || "кг"}`;
  }

  // Для штук, порций
  return `${Number(num.toFixed(2))} ${unit}`;
}

function cleanCategoryName(raw: string, dishName?: string): string {
  let cat = raw
    .replace(/\s*NEW\s*/gi, "")
    .replace(/\s*ДОСТАВКА\s*/gi, "")
    .replace(/!+/g, "")
    .trim();

  const dName = (dishName || "").toLowerCase();

  if (dName.includes("ролл") || dName.includes("филадельфи") || dName.includes("калифорни") || cat.includes("РОЛЛ")) return "Роллы";
  if (dName.includes("суши") || dName.includes("гункан") || cat.includes("СУШИ") || cat.includes("ГУНКАН")) return "Суши & Гунканы";
  if (dName.includes("сет") || cat.includes("СЕТ")) return "Сеты";
  if (dName.includes("пицц") || cat.includes("ПИЦЦ")) return "Пиццы";
  if (dName.includes("салат") || cat.includes("САЛАТ")) return "Салаты";
  if (dName.includes("суп") || dName.includes("том ям") || dName.includes("рамен") || cat.includes("СУП")) return "Супы & Горячее";
  if (dName.includes("вок") || dName.includes("лапша") || dName.includes("рис") || cat.includes("ВОК")) return "WOK & Лапша";
  if (cat.includes("ДОП") || cat.includes("СОУС") || dName.startsWith("соус") || dName.includes("имбирь") || dName.includes("васаби")) return "Соусы & Допы";
  if (cat.includes("НАПИТ") || dName.includes("чай") || dName.includes("кола") || dName.includes("сок") || dName.includes("лимонад")) return "Напитки";
  if (cat.includes("ЗАКУСК") || dName.includes("фри") || dName.includes("наггетс") || dName.includes("кревет")) return "Закуски";

  return cat || "Кухня";
}

/**
 * Получение калькуляций и техкарт блюд из iiko
 */
export async function getIikoSushiRecipes(forceRefresh = false): Promise<IikoRecipesPayload> {
  // 1. Проверяем кэш, если не запрошен принудительный refresh
  if (!forceRefresh && fs.existsSync(CACHE_FILE_PATH)) {
    try {
      const fileData = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
      const parsed: IikoRecipesPayload = JSON.parse(fileData);
      if (parsed.recipes && parsed.recipes.length > 0) {
        return parsed;
      }
    } catch (err) {
      console.warn("Could not read local recipes cache, fetching from iiko:", err);
    }
  }

  // 2. Запрос напрямую из iiko
  const serverUrl = cleanServerBaseUrl(process.env.IIKO_SERVER_URL || "https://sushi-control.iiko.it/resto");
  const token = await getIikoRestoToken();

  // 2.1. Получаем список номенклатуры (XML)
  const xmlRes = await fetch(`${serverUrl}/api/products?includeDeleted=false&key=${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!xmlRes.ok) {
    throw new Error(`Ошибка загрузки продуктов из iiko [${xmlRes.status}]`);
  }
  const xml = await xmlRes.text();

  const items: Array<{
    id: string;
    parentId?: string;
    code?: string;
    name: string;
    productType?: string;
    cookingPlaceType?: string;
    mainUnit?: string;
  }> = [];

  const regex = /<productDto>([\s\S]*?)<\/productDto>/g;
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const block = m[1];
    const id = block.match(/<id>(.*?)<\/id>/)?.[1] || "";
    const parentId = block.match(/<parentId>(.*?)<\/parentId>/)?.[1];
    const code = block.match(/<code>(.*?)<\/code>/)?.[1] || block.match(/<num>(.*?)<\/num>/)?.[1];
    const name = (block.match(/<name>(.*?)<\/name>/)?.[1] || "").trim();
    const productType = block.match(/<productType>(.*?)<\/productType>/)?.[1];
    const cookingPlaceType = block.match(/<cookingPlaceType>(.*?)<\/cookingPlaceType>/)?.[1];
    const mainUnit = block.match(/<mainUnit>(.*?)<\/mainUnit>/)?.[1];

    if (id && name) {
      items.push({ id, parentId, code, name, productType, cookingPlaceType, mainUnit });
    }
  }

  const productsMap = new Map<string, typeof items[0]>();
  items.forEach((i) => productsMap.set(i.id, i));

  // Папки категорий
  const subfolderMap = new Map<string, string>();
  items.forEach(i => {
    if (i.name && (i.productType === "DISH" || !i.productType)) {
      subfolderMap.set(i.id, i.name);
    }
  });

  // 2.2. Фильтруем кухонные позиции: СТРОГО БЛЮДА (DISH)
  const dishes = items.filter((i) => {
    if (i.productType !== "DISH") return false;
    const upperName = i.name.trim().toUpperCase();
    if (
      upperName.startsWith("ПФ ") ||
      upperName.startsWith("ПФ.") ||
      upperName.startsWith("ПФ_") ||
      upperName.includes(" ПФ ") ||
      upperName.includes("ЗАГОТОВК") ||
      upperName.includes("ПОЛУФАБРИКАТ")
    ) {
      return false;
    }
    return true;
  });

  // 2.3. Получаем технологические карты (assemblyCharts)
  const today = new Date().toISOString().split("T")[0];
  const chartRes = await fetch(
    `${serverUrl}/api/v2/assemblyCharts/getAll?dateFrom=2025-01-01&dateTo=${today}&key=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );
  if (!chartRes.ok) {
    throw new Error(`Ошибка загрузки технологических карт из iiko [${chartRes.status}]`);
  }
  const chartData = await chartRes.json();
  const charts: any[] = chartData.assemblyCharts || [];

  const chartMap = new Map<string, any>();
  charts.forEach((c) => {
    chartMap.set(c.assembledProductId, c);
  });

  // 2.4. Сопоставляем блюда с их калькуляционными картами
  const parsedRecipes: IikoRecipe[] = [];

  for (const item of dishes) {
    const chart = chartMap.get(item.id);
    if (!chart || !Array.isArray(chart.items) || chart.items.length === 0) {
      continue;
    }

    const rawCategory = subfolderMap.get(item.parentId!) || "Кухня";
    const category = cleanCategoryName(rawCategory, item.name);

    const ingredients: IikoRecipeIngredient[] = [];
    chart.items.forEach((ing: any) => {
      const prod = productsMap.get(ing.productId);
      const ingName = prod ? prod.name : "Ингредиент";
      const unit = prod?.mainUnit || "кг";
      const gross = ing.amountIn ?? ing.grossWeight ?? ing.amount ?? 0;
      const net = ing.amountOut ?? ing.netWeight ?? ing.amount ?? 0;

      ingredients.push({
        id: ing.productId,
        name: ingName,
        unit,
        grossAmount: gross,
        netAmount: net,
        formattedGross: formatAmount(gross, unit),
        formattedNet: formatAmount(net, unit),
      });
    });

    parsedRecipes.push({
      id: item.id,
      name: item.name,
      code: item.code || "",
      category,
      rawCategory,
      cookingPlace: item.cookingPlaceType || "Кухня",
      yield: `${chart.assembledAmount || 1} ${item.mainUnit || "порц"}`,
      ingredientsCount: ingredients.length,
      ingredients,
      technology: chart?.technologyDescription || chart?.description || "",
      appearance: chart?.appearance || "",
      organoleptic: chart?.organoleptic || "",
      updatedAt: new Date().toISOString(),
    });
  }

  // Сортировка по категориям и названиям
  parsedRecipes.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });

  const categories = Array.from(new Set(parsedRecipes.map((r) => r.category)));

  const payload: IikoRecipesPayload = {
    lastSyncAt: new Date().toISOString(),
    totalCount: parsedRecipes.length,
    categories,
    recipes: parsedRecipes,
  };

  // 3. Сохраняем в локальный файл кэша
  try {
    const dir = path.dirname(CACHE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not save recipes cache file:", err);
  }

  return payload;
}
