import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '../supabase-admin';

const BUCKET = 'profile-assets';

export async function uploadProfileAsset(
  file: File,
  options: { prefix: string; contentType?: string },
) {
  const supabase = getSupabaseAdmin();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileExt = file.name.split('.').pop() || 'bin';
  const fileName = `${options.prefix}/${randomUUID()}.${fileExt}`;

  const { error } = await supabase.storage.from(BUCKET).upload(fileName, buffer, {
    contentType: options.contentType ?? file.type ?? undefined,
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to upload asset: ${error.message}`);
  }

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

  return {
    path: fileName,
    url: signed?.signedUrl ?? null,
  };
}
