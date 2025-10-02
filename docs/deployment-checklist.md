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
- ZAPIER_CATCH_HOOK: Zapier webhook for /api/tilda-proxy forwarding
- ZAPIER_HOOK: alternative hook used by /api/verify page messaging
- REGEN_LINK: link used on /api/verify HTML page to regenerate QR

Supabase setup
- Apply migrations in supabase/migrations (already versioned in repo). If you use Supabase CLI:
  - supabase db reset (local) OR apply in your hosted project via SQL editor
- Confirm the following tables exist and match schema: partners, partner_users, partner_invites, visit_registrations, partner_members, points_history, pending_verifications, rewards, reward_partner_visibility, redemptions

Build and runtime
- Build: npm run build
- Start: npm start (Vercel/hosted platforms will run their own start)
- Health check: GET /api/health => { status: 'ok' }

Recommended rollout steps
1) Prepare env
   - Copy .env.example to your deployment’s environment and fill values
   - Run local validation: npm run env:check
2) Run database migrations (if needed)
3) Deploy application (staging first)
4) Smoke tests
   - GET /api/health (expect 200)
   - Admin overview: GET /api/admin/overview with x-admin-secret (expect 200 JSON)
   - Parity checks: set API_BASE_URL and run npm run parity:check
5) Partner flow
   - Create a partner JWT for test partner
   - POST /api/partner/visit with a test email and payload (expect success)
   - POST /api/partner/mark-visited (expect success and points added)
6) Bonus flow
   - Create a reward (admin) and redeem with POST /api/bonus/redeem-reward
   - Inspect GET /api/partner/check-redemption?code=...

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
