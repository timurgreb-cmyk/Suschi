import { createClient as createAdminClient } from "@supabase/supabase-js";

/**
 * Синхронизирует начисленные за смену оклады (ФОТ) из Suschi Control в систему учета clear.cut (таблица transactions)
 */
export async function syncPayrollToClearcut(params: {
  dateStr: string; // YYYY-MM-DD
  totalAmount: number;
  employeesDetails: Array<{
    name: string;
    position: string;
    shiftRate: number;
    overtimePay: number;
    fineAmount: number;
    finalPay: number;
    hours: string;
  }>;
}): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const { dateStr, totalAmount, employeesDetails } = params;

    if (totalAmount <= 0) {
      return { success: true, error: "Сумма ФОТ равна 0, транзакция не создана" };
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Проверяем наличие таблицы organizations из clear.cut
    const { data: orgs, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .limit(1);

    if (orgError || !orgs || orgs.length === 0) {
      console.warn("clear.cut organizations table not found or empty:", orgError?.message);
      return { success: false, error: "Организация в clear.cut не найдена" };
    }

    const orgId = orgs[0].id;

    // 2. Ищем или создаем категорию 'ФОТ (Оклады персонала)'
    let { data: category } = await supabaseAdmin
      .from("categories")
      .select("id")
      .eq("org_id", orgId)
      .ilike("name", "%ФОТ%")
      .limit(1)
      .single();

    if (!category) {
      // Ищем любую категорию opex
      const { data: fallbackCat } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("org_id", orgId)
        .eq("type", "opex")
        .limit(1)
        .single();

      category = fallbackCat;
    }

    if (!category) {
      return { success: false, error: "Категория расходов ФОТ не найдена в clear.cut" };
    }

    // 3. Ищем счет Касса или Kaspi Pay
    const { data: account } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("org_id", orgId)
      .limit(1)
      .single();

    // 4. Проверяем, не была ли уже создана транзакция за эту дату от suschi_control
    const { data: existingTx } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("org_id", orgId)
      .eq("recognition_date", dateStr)
      .eq("source", "suschi_control")
      .limit(1)
      .single();

    const description = `ФОТ за смену ${dateStr} (Suschi Control: ${employeesDetails.length} сотр.)`;
    const metaPayload = {
      source_app: "suschi_control",
      date: dateStr,
      employees_count: employeesDetails.length,
      employees: employeesDetails,
      synced_at: new Date().toISOString(),
    };

    if (existingTx) {
      // Обновляем существующую транзакцию
      const { error: updateError } = await supabaseAdmin
        .from("transactions")
        .update({
          amount: totalAmount,
          description,
          meta: metaPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTx.id);

      if (updateError) {
        return { success: false, error: `Ошибка обновления в clear.cut: ${updateError.message}` };
      }

      return { success: true, transactionId: existingTx.id };
    } else {
      // Создаем новую транзакцию (контур pl_only / both - начисление расходов)
      const { data: newTx, error: insertError } = await supabaseAdmin
        .from("transactions")
        .insert({
          org_id: orgId,
          account_id: account?.id || null,
          category_id: category.id,
          direction: "expense",
          amount: totalAmount,
          currency: "KZT",
          effective_date: dateStr,
          recognition_date: dateStr,
          description,
          source: "suschi_control",
          contour: "both",
          meta: metaPayload,
        })
        .select("id")
        .single();

      if (insertError) {
        return { success: false, error: `Ошибка записи в clear.cut: ${insertError.message}` };
      }

      return { success: true, transactionId: newTx.id };
    }
  } catch (err: any) {
    console.error("syncPayrollToClearcut error:", err);
    return { success: false, error: err.message };
  }
}
