"use server";

import fs from "fs";
import path from "path";
import { getIikoInventoryNomenclature } from "@/utils/iiko/inventory";
import { revalidatePath } from "next/cache";

export interface TodayInventoryDoc {
  id: string;
  documentNumber: string;
  date: string;
  storeId?: string;
  storeName?: string;
  status: "draft_office" | "sent_to_iiko" | "processed";
  statusText: string;
  itemsCount?: number;
  items?: Record<string, number>;
  source: "iiko_office" | "pwa";
  createdAt?: string;
}

const TODAY_DOCS_PATH = path.join(process.cwd(), "data", "today_inventories_sushi.json");

function readLocalTodayDocs(): TodayInventoryDoc[] {
  try {
    if (!fs.existsSync(TODAY_DOCS_PATH)) return [];
    const content = fs.readFileSync(TODAY_DOCS_PATH, "utf-8");
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    
    const today = new Date().toISOString().split("T")[0];
    return parsed.filter(d => (d.date && d.date.startsWith(today)) || (d.createdAt && d.createdAt.startsWith(today)));
  } catch (err) {
    console.warn("Could not read local today docs:", err);
    return [];
  }
}

function saveLocalTodayDocs(docs: TodayInventoryDoc[]) {
  try {
    const dir = path.dirname(TODAY_DOCS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TODAY_DOCS_PATH, JSON.stringify(docs, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not save local today docs:", err);
  }
}

export async function getInventoryData() {
  try {
    const data = await getIikoInventoryNomenclature();
    return { success: true, data };
  } catch (err: any) {
    console.error("getInventoryData error:", err);
    return { success: false, error: err.message || "Ошибка загрузки номенклатуры", data: null };
  }
}

export async function syncInventoryFromIiko() {
  try {
    const data = await getIikoInventoryNomenclature(true);
    revalidatePath("/app/kitchen/inventory");
    return { success: true, data };
  } catch (err: any) {
    console.error("syncInventoryFromIiko error:", err);
    return { success: false, error: err.message || "Ошибка загрузки номенклатуры" };
  }
}

export async function getTodayInventories(): Promise<{ success: boolean; data: TodayInventoryDoc[]; error?: string }> {
  try {
    const localDocs = readLocalTodayDocs();
    return { success: true, data: localDocs };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function savePwaInventoryDoc(doc: {
  storeId: string;
  storeName: string;
  items: Record<string, number>;
}): Promise<{ success: boolean; error?: string; doc?: TodayInventoryDoc }> {
  try {
    const localDocs = readLocalTodayDocs();
    const now = new Date();
    const count = Object.keys(doc.items).length;

    const newDoc: TodayInventoryDoc = {
      id: `pwa_${Date.now()}`,
      documentNumber: `ИНВ-СУШИ-${Date.now().toString().slice(-4)}`,
      date: now.toISOString(),
      storeId: doc.storeId,
      storeName: doc.storeName,
      status: "sent_to_iiko",
      statusText: "Заполнено поваром (в обработке)",
      itemsCount: count,
      items: doc.items,
      source: "pwa",
      createdAt: now.toISOString(),
    };

    localDocs.push(newDoc);
    saveLocalTodayDocs(localDocs);

    revalidatePath("/app/kitchen/inventory");
    return { success: true, doc: newDoc };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
