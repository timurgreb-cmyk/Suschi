"use server";

import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export interface ChecklistItemData {
  id?: string;
  title: string;
  description?: string;
  item_type: "boolean" | "text" | "number" | "photo";
  is_required: boolean;
  sort_order: number;
}

export interface ChecklistTemplateData {
  id: string;
  title: string;
  description?: string;
  shift_type: "opening" | "closing" | "day" | "any";
  target_role: string;
  location_id?: string | null;
  is_active: boolean;
  items?: ChecklistItemData[];
}

export async function getChecklistTemplates(filters?: { role?: string; locationId?: string; activeOnly?: boolean }) {
  try {
    const supabase = createClient();
    let query = supabase
      .from("checklist_templates")
      .select(`
        id,
        title,
        description,
        shift_type,
        target_role,
        location_id,
        is_active,
        created_at,
        checklist_template_items (
          id,
          title,
          description,
          item_type,
          is_required,
          sort_order
        )
      `)
      .order("created_at", { ascending: true });

    if (filters?.activeOnly !== false) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("Error fetching checklist templates:", error.message);
      return [];
    }

    return (data || []).map((tmpl: any) => ({
      ...tmpl,
      items: (tmpl.checklist_template_items || []).sort(
        (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
      ),
    }));
  } catch (err: any) {
    console.error("getChecklistTemplates exception:", err);
    return [];
  }
}

export async function getChecklistTemplateById(id: string) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("checklist_templates")
      .select(`
        id,
        title,
        description,
        shift_type,
        target_role,
        location_id,
        is_active,
        checklist_template_items (
          id,
          title,
          description,
          item_type,
          is_required,
          sort_order
        )
      `)
      .eq("id", id)
      .single();

    if (error || !data) return null;

    return {
      ...data,
      items: (data.checklist_template_items || []).sort(
        (a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)
      ),
    };
  } catch (err) {
    return null;
  }
}

export async function createChecklistTemplate(formData: {
  title: string;
  description?: string;
  shift_type: "opening" | "closing" | "day" | "any";
  target_role?: string;
  items: Array<{
    title: string;
    description?: string;
    item_type: "boolean" | "text" | "number" | "photo";
    is_required: boolean;
  }>;
}) {
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: template, error: tmplError } = await supabaseAdmin
      .from("checklist_templates")
      .insert({
        title: formData.title,
        description: formData.description || null,
        shift_type: formData.shift_type || "any",
        target_role: formData.target_role || "all",
      })
      .select("id")
      .single();

    if (tmplError || !template) {
      return { success: false, error: tmplError?.message || "Ошибка создания шаблона" };
    }

    if (formData.items && formData.items.length > 0) {
      const itemsToInsert = formData.items.map((item, index) => ({
        template_id: template.id,
        title: item.title,
        description: item.description || null,
        item_type: item.item_type || "boolean",
        is_required: item.is_required !== undefined ? item.is_required : true,
        sort_order: index + 1,
      }));

      const { error: itemsError } = await supabaseAdmin
        .from("checklist_template_items")
        .insert(itemsToInsert);

      if (itemsError) {
        return { success: false, error: itemsError.message };
      }
    }

    revalidatePath("/admin/checklists");
    revalidatePath("/app/checklists");

    return { success: true, templateId: template.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteChecklistTemplate(templateId: string) {
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabaseAdmin
      .from("checklist_templates")
      .delete()
      .eq("id", templateId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/checklists");
    revalidatePath("/app/checklists");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function submitChecklist(payload: {
  templateId: string;
  locationId?: string;
  notes?: string;
  entries: Array<{
    templateItemId: string;
    boolValue?: boolean;
    textValue?: string;
    numberValue?: number;
    photoUrl?: string;
  }>;
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Необходима авторизация" };
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const todayStr = new Date().toISOString().split("T")[0];

    const { data: submission, error: subError } = await supabaseAdmin
      .from("checklist_submissions")
      .insert({
        template_id: payload.templateId,
        employee_id: user.id,
        location_id: payload.locationId || null,
        shift_date: todayStr,
        status: "completed",
        notes: payload.notes || null,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (subError || !submission) {
      return { success: false, error: subError?.message || "Ошибка сохранения чек-листа" };
    }

    if (payload.entries && payload.entries.length > 0) {
      const entryRows = payload.entries.map((e) => ({
        submission_id: submission.id,
        template_item_id: e.templateItemId,
        bool_value: e.boolValue ?? false,
        text_value: e.textValue || null,
        number_value: e.numberValue || null,
        photo_url: e.photoUrl || null,
      }));

      const { error: entriesError } = await supabaseAdmin
        .from("checklist_submission_entries")
        .insert(entryRows);

      if (entriesError) {
        return { success: false, error: entriesError.message };
      }
    }

    revalidatePath("/app/checklists");
    revalidatePath("/admin/checklists");

    return { success: true, submissionId: submission.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getSubmissionsForDate(dateStr?: string) {
  try {
    const targetDate = dateStr || new Date().toISOString().split("T")[0];
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from("checklist_submissions")
      .select(`
        id,
        template_id,
        employee_id,
        location_id,
        shift_date,
        status,
        notes,
        created_at,
        completed_at,
        profiles (full_name, position),
        locations (name),
        checklist_templates (title, shift_type),
        checklist_submission_entries (
          id,
          template_item_id,
          bool_value,
          text_value,
          number_value,
          photo_url,
          checklist_template_items (title, item_type)
        )
      `)
      .eq("shift_date", targetDate)
      .order("completed_at", { ascending: false });

    if (error) {
      console.warn("Error fetching submissions:", error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    return [];
  }
}

export async function getEmployeeTodaySubmissions() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const todayStr = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("checklist_submissions")
      .select(`
        id,
        template_id,
        shift_date,
        status,
        completed_at,
        checklist_templates (title, shift_type)
      `)
      .eq("employee_id", user.id)
      .eq("shift_date", todayStr);

    if (error) return [];
    return data || [];
  } catch (err) {
    return [];
  }
}
