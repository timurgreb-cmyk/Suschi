import fs from "fs";
import path from "path";
import { getIikoRestoToken, cleanServerBaseUrl } from "./client";

const CACHE_FILE_PATH = path.join(process.cwd(), "data", "iiko_inventory_cache.json");

export interface InventoryItem {
  id: string;
  parentId?: string;
  code: string;
  name: string;
  productType: string;
  mainUnit: string;
  category: string;
  ingredients?: Array<{
    productId: string;
    name: string;
    amount: number;
    unit: string;
  }>;
}

export interface InventoryPayload {
  lastSyncAt: string;
  goods: InventoryItem[];
  preparations: InventoryItem[];
}

export async function getIikoInventoryNomenclature(forceRefresh = false): Promise<InventoryPayload> {
  if (!forceRefresh && fs.existsSync(CACHE_FILE_PATH)) {
    try {
      const parsed: InventoryPayload = JSON.parse(fs.readFileSync(CACHE_FILE_PATH, "utf-8"));
      if ((parsed.goods && parsed.goods.length > 0) || (parsed.preparations && parsed.preparations.length > 0)) {
        return parsed;
      }
    } catch (err) {
      console.warn("Local inventory cache read error:", err);
    }
  }

  const serverUrl = cleanServerBaseUrl(process.env.IIKO_SERVER_URL || "https://sushi-control.iiko.it/resto");
  const token = await getIikoRestoToken();

  const xmlRes = await fetch(`${serverUrl}/api/products?includeDeleted=false&key=${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!xmlRes.ok) throw new Error("Failed to load products from iiko");
  const xml = await xmlRes.text();

  const items: any[] = [];
  const regex = /<productDto>([\s\S]*?)<\/productDto>/g;
  let m;
  while ((m = regex.exec(xml)) !== null) {
    const block = m[1];
    const id = block.match(/<id>(.*?)<\/id>/)?.[1] || "";
    const parentId = block.match(/<parentId>(.*?)<\/parentId>/)?.[1];
    const code = block.match(/<code>(.*?)<\/code>/)?.[1] || block.match(/<num>(.*?)<\/num>/)?.[1] || "";
    const name = (block.match(/<name>(.*?)<\/name>/)?.[1] || "").trim();
    const productType = block.match(/<productType>(.*?)<\/productType>/)?.[1] || "";
    const mainUnit = block.match(/<mainUnit>(.*?)<\/mainUnit>/)?.[1] || "кг";

    if (id && name) {
      items.push({ id, parentId, code, name, productType, mainUnit });
    }
  }

  const productsMap = new Map<string, any>();
  items.forEach(i => productsMap.set(i.id, i));

  // Determine categories
  const categoryMap = new Map<string, string>();
  items.forEach(i => {
    if (!i.parentId) {
      categoryMap.set(i.id, i.name);
    }
  });
  let added = true;
  while (added) {
    added = false;
    items.forEach(i => {
      if (i.parentId && categoryMap.has(i.parentId) && !categoryMap.has(i.id) && i.productType !== "GOODS" && i.productType !== "PREPARED") {
        categoryMap.set(i.id, categoryMap.get(i.parentId) || i.name);
        added = true;
      }
    });
  }

  const goods = items.filter(i => i.productType === "GOODS").map(i => ({ ...i, category: categoryMap.get(i.parentId) || "Сырье и товары" }));
  const preps = items.filter(i => i.productType === "PREPARED").map(i => ({ ...i, category: categoryMap.get(i.parentId) || "Полуфабрикаты" }));

  // Fetch all assembly charts in a single fast call
  try {
    const today = new Date().toISOString().split("T")[0];
    const chartUrl = `${serverUrl}/api/v2/assemblyCharts/getAll?dateFrom=2025-01-01&dateTo=${today}&key=${encodeURIComponent(token)}`;
    const chartRes = await fetch(chartUrl, { cache: "no-store" });
    if (chartRes.ok) {
      const chartJson = await chartRes.json();
      const charts: any[] = chartJson.assemblyCharts || [];
      const chartMap = new Map<string, any>();
      charts.forEach((c) => {
        if (c.assembledProductId) {
          chartMap.set(c.assembledProductId, c);
        }
      });

      preps.forEach((prep) => {
        const chart = chartMap.get(prep.id);
        if (chart && Array.isArray(chart.items) && chart.items.length > 0) {
          const divisor = chart.assembledAmount && chart.assembledAmount > 0 ? chart.assembledAmount : 1;
          const ingredients: Array<{ productId: string; name: string; amount: number; unit: string }> = [];
          
          chart.items.forEach((ing: any) => {
            const rawAmount = ing.amountIn || ing.amountMiddle || ing.amountOut || 0;
            const ingProd = productsMap.get(ing.productId);
            if (ingProd && rawAmount > 0) {
              ingredients.push({
                productId: ing.productId,
                name: ingProd.name,
                amount: rawAmount / divisor,
                unit: ingProd.mainUnit || "кг",
              });
            }
          });
          prep.ingredients = ingredients;
        }
      });
    }
  } catch (chartErr) {
    console.warn("Could not load assembly charts in bulk:", chartErr);
  }

  const payload: InventoryPayload = {
    lastSyncAt: new Date().toISOString(),
    goods,
    preparations: preps,
  };

  const dir = path.dirname(CACHE_FILE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(payload, null, 2), "utf-8");

  return payload;
}
