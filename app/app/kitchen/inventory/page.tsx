import { getInventoryData, getTodayInventories } from "@/app/actions/inventory";
import { getIikoStores } from "@/app/actions/stores";
import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [invResult, storesResult, todayDocsResult] = await Promise.all([
    getInventoryData(),
    getIikoStores(),
    getTodayInventories(),
  ]);

  const initialData = invResult.data || { lastSyncAt: "", goods: [], preparations: [] };
  const initialStores = storesResult.data && storesResult.data.length > 0 ? storesResult.data : [];
  const initialTodayDocs = todayDocsResult.data || [];
  
  return (
    <InventoryClient 
      initialData={initialData} 
      initialStores={initialStores} 
      initialTodayDocs={initialTodayDocs} 
    />
  );
}
