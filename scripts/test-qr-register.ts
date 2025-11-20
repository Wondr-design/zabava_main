import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { POST as registerQr } from "@/app/api/qr/register/route";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

interface VisitRow {
  id: string;
  email: string;
  partner_id: string | null;
  status: string;
  legacy_qr_key: string | null;
  estimated_points: number | null;
  total_price: number | null;
  num_people: number | null;
  ticket_type: string | null;
  transport: string | null;
  categories: string | null;
  submission_id: string | null;
  created_at: string | null;
}

// Provide defaults so the script can run locally without extra setup.
process.env.ADMIN_SECRET = process.env.ADMIN_SECRET || "dev-admin-secret";
process.env.JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret";
process.env.SUPABASE_URL =
  process.env.SUPABASE_URL || "https://umiegvenctkuiwekxobj.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaWVndmVuY3RrdWl3ZWt4b2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY3Mjc3NCwiZXhwIjoyMDcwMjQ4Nzc0fQ.6E-DLAT6VQPCsm5_BJngsAnXLoExd5sxTGEZjFQGuQA";

async function run() {
  const timestamp = Date.now();
  const email = `qrtest+${timestamp}@example.com`;
  const partnerId = `qr-auto-${timestamp}`;
  const submissionId = randomUUID();

  const supabase = getSupabaseAdmin();

  const nowIso = new Date().toISOString();
  const partnerRow = {
    id: partnerId,
    display_name: `QR Test ${timestamp}`,
    status: "active",
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { error: partnerError } = await supabase
    .from("partners")
    .upsert(partnerRow as unknown as never, { onConflict: "id" });

  if (partnerError) {
    throw new Error(`Failed to seed partner: ${partnerError.message}`);
  }

  const payload = {
    email,
    partnerId,
    submissionId,
    data: {
      partnerId,
      ticketType: "VIP",
      numPeople: 2,
      transport: "yes",
      totalPrice: 450,
      categories: "family",
    },
  };

  const request = new Request("https://example.com/api/qr/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }) as unknown as NextRequest;

  const response = await registerQr(request);
  const result = await response.json();

  console.log("API status:", response.status);
  console.log("API body:", result);

  if (!response.ok) {
    throw new Error(`Request failed: ${result?.error || response.status}`);
  }

  const visitId: string | undefined = result?.visit?.id;
  if (!visitId) {
    throw new Error("API did not return a visit ID");
  }

  const { data: visitData, error } = await supabase
    .from("visit_registrations")
    .select(
      "id,email,partner_id,status,legacy_qr_key,estimated_points,total_price,num_people,ticket_type,transport,categories,submission_id,created_at"
    )
    .eq("id", visitId)
    .maybeSingle();

  const visit = visitData as VisitRow | null;

  if (error) {
    throw new Error(`Supabase lookup failed: ${error.message}`);
  }

  if (!visit) {
    throw new Error("Visit record not found in Supabase");
  }

  console.log("Supabase visit row:", visit);

  if (visit.email !== email.trim().toLowerCase()) {
    throw new Error(
      `Email mismatch: expected ${email}, received ${visit.email}`
    );
  }

  if (visit.partner_id !== partnerId.trim().toLowerCase()) {
    throw new Error(
      `Partner mismatch: expected ${partnerId}, received ${visit.partner_id}`
    );
  }

  if (
    typeof visit.legacy_qr_key !== "string" ||
    visit.legacy_qr_key.length === 0
  ) {
    throw new Error("Legacy QR key missing from stored visit");
  }

  if (visit.status !== "pending") {
    throw new Error(`Unexpected visit status: ${visit.status}`);
  }

  try {
    await supabase.from("visit_registrations").delete().eq("id", visitId);
    // Clean up partner row if it was just created for the test.
    await supabase.from("partners").delete().eq("id", partnerId);
  } catch (cleanupError) {
    console.warn("Cleanup failed:", cleanupError);
  }

  console.log("QR registration storage test completed successfully.");
}

run().catch((err) => {
  console.error("QR registration storage test failed.", err);
  process.exitCode = 1;
});
