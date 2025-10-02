import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { getSupabaseAdmin } from '../supabase-admin';

const DEFAULT_BUCKET = process.env.SUPABASE_QR_BUCKET || 'qr-codes';
const MAX_SIGNED_URL_SECONDS = 60 * 60 * 24 * 7; // Supabase limit (7 days)
const DEFAULT_EXPIRY_SECONDS = Math.min(
  Number(process.env.QR_CODE_EXPIRES_IN || 60 * 60 * 24 * 3),
  MAX_SIGNED_URL_SECONDS
);

export interface QrCodeResult {
  url: string;
  expiresAt: string;
  path: string;
}

async function ensureSignedUrl(bucket: string, path: string, expiresInSeconds: number) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds, { download: false });

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed QR URL: ${error?.message ?? 'unknown error'}`);
  }

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  return { url: data.signedUrl, expiresAt };
}

export async function generateQrCodeForVisit(verifyUrl: string, visitId: string): Promise<QrCodeResult> {
  if (!verifyUrl) {
    throw new Error('verifyUrl is required to generate QR code');
  }
  if (!visitId) {
    throw new Error('visitId is required to store QR code');
  }

  const svg = await QRCode.toString(verifyUrl, { type: 'svg' });
  const supabase = getSupabaseAdmin();
  const bucket = DEFAULT_BUCKET;
  const path = `visits/${visitId}/${randomUUID()}.svg`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, svg, {
      contentType: 'image/svg+xml',
      upsert: true,
      cacheControl: '3600',
    });

  if (uploadError) {
    throw new Error(`Failed to upload QR code: ${uploadError.message}`);
  }

  const { url, expiresAt } = await ensureSignedUrl(bucket, path, DEFAULT_EXPIRY_SECONDS);

  return { url, expiresAt, path };
}
