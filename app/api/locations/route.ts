import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = getSupabase();
  const { data: locations, error } = await supabase
    .from("locations")
    .select("*")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ locations });
}

export async function POST(request: Request) {
  const supabase = getSupabase();
  const { name, base_hours, work_start_time, work_end_time, late_fine_amount } = await request.json();

  if (!name) return NextResponse.json({ error: "Название обязательно" }, { status: 400 });

  const { data, error } = await supabase
    .from("locations")
    .insert({ 
      name, 
      is_active: true, 
      base_hours: base_hours || 8,
      work_start_time: work_start_time || "11:00",
      work_end_time: work_end_time || "00:00",
      late_fine_amount: late_fine_amount || 0
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ location: data });
}

export async function PATCH(request: Request) {
  const supabase = getSupabase();
  const { id, is_active } = await request.json();

  if (!id) return NextResponse.json({ error: "ID локации обязателен" }, { status: 400 });

  const { data, error } = await supabase
    .from("locations")
    .update({ is_active })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ location: data });
}

export async function DELETE(request: Request) {
  const supabase = getSupabase();
  const { id } = await request.json();

  if (!id) return NextResponse.json({ error: "ID локации обязателен" }, { status: 400 });

  // Сначала пытаемся удалить физически
  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", id);

  if (error) {
    // Код 23503 в Postgres означает нарушение foreign key constraint (нарушение целостности связей)
    if (error.code === "23503" || error.message?.includes("foreign key")) {
      // Локация использовалась сотрудниками. Вместо удаления деактивируем ее
      const { error: updateError } = await supabase
        .from("locations")
        .update({ is_active: false })
        .eq("id", id);
      
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      return NextResponse.json({ 
        success: true, 
        archived: true, 
        message: "Локация содержит отметки сотрудников, поэтому она была автоматически отключена, а не удалена безвозвратно." 
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, archived: false });
}
