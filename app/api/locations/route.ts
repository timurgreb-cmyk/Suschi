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
