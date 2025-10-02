import { createPendingVerification } from '../src/lib/data/pending';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaWVndmVuY3RrdWl3ZWt4b2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY3Mjc3NCwiZXhwIjoyMDcwMjQ4Nzc0fQ.6E-DLAT6VQPCsm5_BJngsAnXLoExd5sxTGEZjFQGuQA';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://umiegvenctkuiwekxobj.supabase.co';

(async () => {
  try {
    const now = new Date();
    const res = await createPendingVerification({
      rid: 'gen%m8ggrcom?n21',
      email: 'testzap+cli@example.com',
      verifyUrl: 'https://zabava.vercel.app/api/verify?email=testzap%2Bcli%40example.com&visitId=b2276497-70ee-4cab-b27b-0493b7368af3',
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    });
    console.log('result', res);
  } catch (err) {
    console.error('error', err);
  }
})();
