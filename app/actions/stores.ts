"use server";

export async function getIikoStores() {
  try {
    const { getIikoRestoToken, cleanServerBaseUrl } = await import("@/utils/iiko/client");
    const token = await getIikoRestoToken();
    const serverUrl = cleanServerBaseUrl(process.env.IIKO_SERVER_URL || "");

    const url = `${serverUrl}/api/corporation/stores?key=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load stores from iiko");
    
    const xml = await res.text();
    const stores: { id: string, name: string }[] = [];
    
    const regex = /<(?:corporationStoreDto|corporateItemDto)>([\s\S]*?)<\/(?:corporationStoreDto|corporateItemDto)>/g;
    let m;
    while ((m = regex.exec(xml)) !== null) {
      const block = m[1];
      const type = block.match(/<type>(.*?)<\/type>/)?.[1];
      if (!type || type === "STORE") {
        const id = block.match(/<id>(.*?)<\/id>/)?.[1];
        const name = block.match(/<name>(.*?)<\/name>/)?.[1];
        if (id && name) {
          stores.push({ id, name });
        }
      }
    }

    if (stores.length === 0) {
      const deptUrl = `${serverUrl}/api/corporation/departments?key=${encodeURIComponent(token)}`;
      const deptRes = await fetch(deptUrl);
      if (deptRes.ok) {
        const deptXml = await deptRes.text();
        const dReg = /<corporateItemDto>([\s\S]*?)<\/corporateItemDto>/g;
        let dm;
        while ((dm = dReg.exec(deptXml)) !== null) {
          const type = dm[1].match(/<type>(.*?)<\/type>/)?.[1];
          if (type === "STORE") {
             const id = dm[1].match(/<id>(.*?)<\/id>/)?.[1];
             const name = dm[1].match(/<name>(.*?)<\/name>/)?.[1];
             if (id && name) stores.push({ id, name });
          }
        }
      }
    }

    if (stores.length === 0) {
      stores.push(...FALLBACK_STORES);
    }

    return { success: true, data: stores };
  } catch (e: any) {
    console.error("getIikoStores error, using fallback stores:", e);
    return { success: true, data: FALLBACK_STORES };
  }
}

const FALLBACK_STORES = [
  { id: "10000000-0000-0000-0000-000000000001", name: "Основной склад" },
  { id: "10000000-0000-0000-0000-000000000002", name: "Склад Кухня / Суши" },
  { id: "10000000-0000-0000-0000-000000000003", name: "Склад Бар / Напитки" },
  { id: "10000000-0000-0000-0000-000000000004", name: "Склад Хоз.товары и упаковка" },
];
