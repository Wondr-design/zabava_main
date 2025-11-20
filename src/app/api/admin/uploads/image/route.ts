import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";

import { getAuthFromRequest } from "@/lib/auth/request";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { log, getCorrelationId } from "@/lib/logging";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const ASSET_BUCKET = process.env.SUPABASE_ASSET_BUCKET || "public-assets";
const DEFAULT_FOLDER = "uploads";

function sanitizeFolder(value: string | null): string {
  if (!value) return DEFAULT_FOLDER;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_FOLDER;
  return (
    trimmed
      .replace(/[^a-zA-Z0-9/_-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/\/{2,}/g, "/")
      .replace(/^\//, "")
      .replace(/\/$/, "") || DEFAULT_FOLDER
  );
}

function isAuthorized(req: NextRequest) {
  const auth = getAuthFromRequest(req);
  if (auth?.role === "admin") return true;
  const adminSecret = req.headers.get("x-admin-secret");
  if (ADMIN_SECRET && adminSecret === ADMIN_SECRET) {
    return true;
  }
  return false;
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }

  const folder = sanitizeFolder(
    typeof formData.get("folder") === "string"
      ? (formData.get("folder") as string)
      : null
  );

  const contentType =
    (typeof formData.get("contentType") === "string"
      ? (formData.get("contentType") as string)
      : null) ??
    (file.type || undefined);

  const ext = (() => {
    const parts = file.name?.split(".") ?? [];
    const last = parts.pop();
    if (!last) return "bin";
    return last.toLowerCase();
  })();

  const fileName = `${folder}/${randomUUID()}.${ext}`;

  try {
    const supabase = getSupabaseAdmin();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(ASSET_BUCKET)
      .upload(fileName, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      log.error("admin_upload_image_failed", uploadError, {
        bucket: ASSET_BUCKET,
        path: fileName,
        correlationId: getCorrelationId(request),
      });
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    const { data: publicData } = supabase.storage
      .from(ASSET_BUCKET)
      .getPublicUrl(fileName);

    return NextResponse.json({
      path: fileName,
      url: publicData?.publicUrl ?? null,
      contentType: contentType ?? null,
    });
  } catch (error) {
    log.error("admin_upload_image_exception", error, {
      bucket: ASSET_BUCKET,
      correlationId: getCorrelationId(request),
    });
    return NextResponse.json(
      { error: "Unexpected error while uploading" },
      { status: 500 }
    );
  }
}
