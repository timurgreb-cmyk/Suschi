import { getCalculationsData } from "@/app/actions/calculations";
import CalculationsClient from "./CalculationsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CalculationsPage() {
  const result = await getCalculationsData();

  const initialData = result.data || {
    lastSyncAt: "",
    totalCount: 0,
    categories: [],
    recipes: [],
  };

  return <CalculationsClient initialData={initialData} />;
}
