# Deployment and environment checklist

This guide covers required environment variables, deployment steps, and how to verify a healthy rollout for the Zabava Next.js API.

Core environment variables (required)

- ADMIN_SECRET: shared secret for admin endpoints (x-admin-secret)
- JWT_SECRET: used to verify partner/admin JWTs
- SUPABASE_URL: Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (server-only)

Common/optional environment variables

- ALLOWED_ORIGIN: default CORS origin for most JSON endpoints
- DASHBOARD_BASE_URL: admin dashboard base URL (used for invite URLs and as default CORS)
- PENDING_ACCESS_TOKEN: token required by /api/pending (alternative to admin secret)
- PENDING_ALLOWED_ORIGIN: CORS origin override for /api/pending
- BASE_URL: canonical API base URL (used to build /api/verify link in some flows)
- NEXT_PUBLIC_BASE_URL: same as BASE_URL but exposed to client if needed; server prefers BASE_URL
- JWT_EXPIRES_IN: custom JWT expiration (e.g. 12h, 1d). Default: 12h
- LOG_LEVEL: debug | info | warn | error (default: info)
- REDEMPTION_PROCESSED_WEBHOOK_URL: optional webhook called when a partner processes a redemption
- N8N_EMAIL_VERIFICATION_WEBHOOK: webhook invoked when a verification code is issued to email the user
- N8N_EMAIL_VERIFICATION_WEBHOOK_AUTH: optional header value sent to that webhook (e.g., Authorization token)
- N8N_PARTNER_INVITE_WEBHOOK: webhook called after an admin creates a partner invite
- N8N_PARTNER_INVITE_WEBHOOK_AUTH: optional header token for the partner invite webhook
- N8N_PARTNER_BILLING_WEBHOOK: webhook triggered when monthly billing is requested from the admin UI
- N8N_PARTNER_BILLING_WEBHOOK_AUTH: optional header token for the billing webhook
- N8N_VISIT_UPDATE_WEBHOOK: webhook invoked after staff edits a visit (used to email the guest with changes)
- N8N_VISIT_UPDATE_WEBHOOK_AUTH: optional header token for the visit update webhook
- EMAIL_VERIFICATION_CODE_LENGTH: digits in one-time code (default 6)
- EMAIL_VERIFICATION_TTL_MINUTES: minutes before a verification code expires (default 15)
- EMAIL_VERIFICATION_REQUEST_COOLDOWN_SECONDS: rate limit between code requests (default 60)
- EMAIL_VERIFICATION_MAX_ATTEMPTS: maximum failed attempts before forcing a new code (default 5)
- QR_CODE_EXPIRES_IN_DAYS: default signed URL lifetime for visit QR codes (fallback 3 days)
- REGEN_LINK: link used on /api/verify HTML page to regenerate QR
- ZAPIER_HOOK: optional hook still used by /api/verify page messaging

Supabase setup

- Apply migrations in supabase/migrations (already versioned in repo). If you use Supabase CLI:
  - supabase db reset (local) OR apply in your hosted project via SQL editor
- Confirm the following tables exist and match schema: partners, partner_users, partner_invites, visit_registrations, partner_members, points_history, pending_verifications, email_verifications, rewards, reward_partner_visibility, redemptions

Build and runtime

- Build: npm run build
- Start: npm start (Vercel/hosted platforms will run their own start)
- Health check: GET /api/health => { status: 'ok' }

Recommended rollout steps

1. Prepare env
   - Copy .env.example to your deployment’s environment and fill values
   - Run local validation: npm run env:check
2. Run database migrations (if needed)
3. Deploy application (staging first)
4. Smoke tests
   - GET /api/health (expect 200)
   - Admin overview: GET /api/admin/overview with x-admin-secret (expect 200 JSON)
   - Parity checks: set API_BASE_URL and run npm run parity:check
5. Partner flow
   - Create a partner JWT for test partner
   - POST /api/partner/visit with a test email and payload (expect success)
   - POST /api/partner/mark-visited (expect success and points added)
6. Public booking flow
   - Request an email verification code via POST /api/auth/request-code
   - Verify with POST /api/auth/verify-code, then POST /api/public/visit to ensure visit + QR generation succeed
   - Load /api/verify?visitId=...&email=... to confirm the verification page renders correctly
7. Bonus flow
   - Create a reward (admin) and redeem with POST /api/bonus/redeem-reward
   - Inspect GET /api/partner/check-redemption?code=...
8. Billing automation
   - Trigger POST /api/admin/partners/{partnerId}/bill with valid admin credentials and confirm the n8n webhook processes the payload

Observability

- Structured logs are enabled via src/lib/logging.ts
  - Set LOG_LEVEL=debug during staging for more detail
  - Each request logs key events with correlationId if x-correlation-id header is provided (or auto-generated)

CORS

- Most endpoints default to origin from ALLOWED_ORIGIN or DASHBOARD_BASE_URL
- /api/pending uses its own PENDING_ALLOWED_ORIGIN

Verification utilities

- Env check: npm run env:check
- Parity checks: npm run parity:check (see scripts/parity/checks.js)

Troubleshooting

- 401 Unauthorized
  - Admin: ensure ADMIN_SECRET matches
  - Partner: ensure JWT signed with JWT_SECRET and includes partnerId (or role=admin)
- Supabase errors
  - Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set and valid
  - Check RLS policies if you introduce them; current code assumes service role on server
