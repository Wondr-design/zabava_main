import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { withCors, preflightResponse } from "@/lib/http/cors";

const CORS_CONFIG = {
  methods: "GET, OPTIONS",
  headers: "Content-Type",
} as const;

export function OPTIONS() {
  return preflightResponse(CORS_CONFIG);
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("global_values")
      .select("key, label")
      .eq("value_type", "ticket_type")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      return withCors(
        NextResponse.json(
          { error: "Failed to fetch ticket types" },
          { status: 500 },
        ),
        CORS_CONFIG,
      );
    }

    const ticketTypes = (data ?? []).map((item) => ({
      value: item.key,
      label: item.label,
    }));

    return withCors(NextResponse.json({ ticketTypes }), CORS_CONFIG);
  } catch (error) {
    console.error("ticket_types_error", error);
    return withCors(
      NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      ),
      CORS_CONFIG,
    );
  }
}
