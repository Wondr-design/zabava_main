import { createClient } from '@supabase/supabase-js';
import { normalizeVisitRecord } from '@/lib/services/visit-normalizer';

(async () => {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('visit_registrations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    console.error('Query error', error?.message);
    process.exit(1);
  }

  const visit = data[0];
  const normalized = normalizeVisitRecord({
    payload: (visit.payload || {}) as Record<string, unknown>,
    visitRecord: visit as unknown as Record<string, unknown>,
  });

  console.log('Visit ID:', visit.id);
  console.log('Payload keys:', Object.keys(visit.payload || {}));
  console.log('Payload data keys:', Object.keys((visit.payload?.data as Record<string, unknown>) || {}));
  console.log('Normalized transport:', normalized.transport);
})();
