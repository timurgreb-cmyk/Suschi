"use server";

import { getIikoSushiRecipes, IikoRecipesPayload } from "@/utils/iiko/calculations";
import { revalidatePath } from "next/cache";

export async function getCalculationsData(): Promise<{
  success: boolean;
  data?: IikoRecipesPayload;
  error?: string;
}> {
  try {
    const data = await getIikoSushiRecipes(false);
    return { success: true, data };
  } catch (err: any) {
    console.error("getCalculationsData error:", err);
    return { success: false, error: err.message || "Ошибка загрузки калькуляций" };
  }
}

export async function syncCalculationsFromIiko(): Promise<{
  success: boolean;
  data?: IikoRecipesPayload;
  error?: string;
}> {
  try {
    const data = await getIikoSushiRecipes(true);
    revalidatePath("/app/kitchen/recipes");
    return { success: true, data };
  } catch (err: any) {
    console.error("syncCalculationsFromIiko error:", err);
    return { success: false, error: err.message || "Ошибка синхронизации с iiko" };
  }
}
