import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { POST as registerVisit } from "@/app/api/register/route";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

process.env.ADMIN_SECRET = process.env.ADMIN_SECRET || "dev-admin-secret";
process.env.JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret";
process.env.BASE_URL = process.env.BASE_URL || "https://example.com";
process.env.SUPABASE_URL =
  process.env.SUPABASE_URL || "https://umiegvenctkuiwekxobj.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaWVndmVuY3RrdWl3ZWt4b2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY3Mjc3NCwiZXhwIjoyMDcwMjQ4Nzc0fQ.6E-DLAT6VQPCsm5_BJngsAnXLoExd5sxTGEZjFQGuQA";

const BUCKET = process.env.SUPABASE_QR_BUCKET || "qr-codes";

async function run() {
  const supabase = getSupabaseAdmin();
  const timestamp = Date.now();
  const email = `qrstorage+${timestamp}@example.com`;
  const partnerId = `qr-store-${timestamp}`;
  const submissionId = `form-${randomUUID()}`;

  const nowIso = new Date().toISOString();
  const partnerRow = {
    id: partnerId,
    display_name: `QR Storage Test ${timestamp}`,
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
    data: {
      submissionId,
      partnerId,
      ticketType: "VIP",
      numPeople: 3,
      transport: "yes",
      totalPrice: 600,
      categories: "family",
    },
  };

  const request = new Request("https://example.com/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }) as unknown as NextRequest;

  const response = await registerVisit(request);
  const body = await response.json();

  console.log("Register status:", response.status);
  console.log("Register body:", body);

  if (!response.ok) {
    throw new Error(`Register API failed: ${body?.error || response.status}`);
  }

  const { data: visitRowData, error: visitError } = await supabase
    .from("visit_registrations")
    .select("id, payload")
    .eq("submission_id", submissionId.toLowerCase())
    .eq("email", email)
    .maybeSingle();

  const visitRow = visitRowData as { id: string } | null;

  if (visitError) {
    throw new Error(`Failed to load visit: ${visitError.message}`);
  }

  if (!visitRow?.id) {
    throw new Error("Visit record not found after registration");
  }

  const visitId = visitRow.id;

  const { data: storageObjects, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(`visits/${visitId}`, { limit: 5 });

  if (listError) {
    throw new Error(`Storage listing failed: ${listError.message}`);
  }

  if (!storageObjects || storageObjects.length === 0) {
    throw new Error("No QR code file found in Supabase storage");
  }

  const object = storageObjects[0];
  console.log("QR Storage object:", object);

  const { data: downloaded, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(`visits/${visitId}/${object.name}`);

  if (downloadError) {
    throw new Error(`Failed to download QR code: ${downloadError.message}`);
  }

  const text = await downloaded.text();
  if (!text.includes("<svg")) {
    throw new Error("Downloaded QR code is not an SVG document");
  }

  console.log("Downloaded QR SVG length:", text.length);

  try {
    await supabase.storage
      .from(BUCKET)
      .remove([`visits/${visitId}/${object.name}`]);
    await supabase.from("visit_registrations").delete().eq("id", visitId);
    await supabase.from("partners").delete().eq("id", partnerId);
  } catch (cleanupError) {
    console.warn("Cleanup warning:", cleanupError);
  }

  console.log("QR storage verification succeeded.");
}

run().catch((err) => {
  console.error("QR storage verification failed.", err);
  process.exitCode = 1;
});
