# KV → Supabase mapping (Zabava Next.js)

This document maps the legacy KV data model and API behaviors to the current Supabase-backed schema and endpoints. It is intended for maintenance, debugging, and future enhancements while preserving legacy parity.

Highlights
- All legacy flows are backed by normalized Supabase tables.
- Response shapes and status semantics match legacy where clients depend on them.
- Auth parity: endpoints accept the same roles/secrets as before (admin secret, admin JWT, partner JWT) where applicable.

---

Schema overview (public)
- partners
  - id (text, PK)
  - display_name (text)
  - status (text: active | pending | inactive)
  - contact_email (citext), contact_name (text)
  - tags (text[])
  - website (text)
  - contract (jsonb), ticketing (jsonb), info (jsonb), media (jsonb)
  - bonus_program_enabled (boolean)
  - notes (text)
  - created_at, updated_at
- partner_users
  - email (citext, PK)
  - password_hash (text)
  - partner_id (text → partners.id, nullable)
  - role (text: partner | admin)
  - name (text), metadata (jsonb), created_at, updated_at, last_login_at
- partner_invites
  - id (uuid, PK)
  - token (text, unique)
  - email (citext)
  - partner_id (text → partners.id)
  - role (text: partner | admin)
  - name (text), metadata (jsonb)
  - created_at, expires_at
  - used (boolean), used_at
- visit_registrations
  - id (uuid, PK)
  - submission_id (text)
  - email (citext)
  - partner_id (text → partners.id, nullable)
  - status (text: pending | visited | cancelled)
  - payload (jsonb)
  - estimated_points (int), points_awarded (int)
  - total_price (numeric(12,2))
  - num_people (int)
  - ticket_type (text)
  - transport (text)
  - categories (text)
  - visited_at (timestamptz)
  - visit_notes (text)
  - has_redemption (boolean)
  - redemption_code (text), redemption_reward (text), redemption_value (int)
  - legacy_qr_key (text)
  - created_at, updated_at
- partner_members
  - partner_id (text → partners.id)
  - email (citext)
  - first_seen_at (timestamptz)
  - PK (partner_id, email)
- points_history
  - id (uuid, PK), email (citext)
  - type (text: earned | redemption | adjustment)
  - points (int)
  - partner_id (text → partners.id, nullable)
  - partner_name (text, nullable)
  - visit_id (uuid → visit_registrations.id, nullable)
  - meta (jsonb)
  - created_at
- pending_verifications
  - id (uuid, PK)
  - rid (text, unique)
  - email (citext)
  - verify_url (text)
  - qr_url (text)
  - visit_id (uuid → visit_registrations.id, nullable)
  - legacy_key (text)
  - created_at, expires_at
- rewards
  - id (text, PK)
  - name (text)
  - description (text)
  - points_cost (int)
  - category (text: discount | freebie | experience | merchandise | other)
  - stock (int, nullable), image_url (text), redemption_instructions (text)
  - valid_until (timestamptz, nullable)
  - status (text: active | inactive)
  - created_at, updated_at, deleted_at (nullable)
- reward_partner_visibility
  - reward_id (text → rewards.id)
  - partner_id (text → partners.id)
  - PK (reward_id, partner_id)
- redemptions
  - id (uuid, PK)
  - code (text, unique)
  - email (citext)
  - reward_id (text → rewards.id)
  - partner_id (text → partners.id, nullable)
  - status (text: pending | applied | used | rejected)
  - created_at, updated_at
  - applied_at, used_at, expires_at (timestamptz, nullable)
  - applied_to_visit_id (uuid → visit_registrations.id, nullable)
  - metadata (jsonb)

---

Legacy KV → Supabase mapping by domain

Partners (directory, metadata)
- KV: per-partner object storing status, contact, tags, website, contract/ticketing/info/media, bonus program flag, notes
- Supabase: partners
- Status mapping
  - legacy 'active' → partners.status = active
  - legacy 'pending' → partners.status = pending
  - legacy 'hidden' → partners.status = inactive (stored as inactive; rendered as hidden in app)
- JSON blobs
  - contract, ticketing, info, media move into jsonb columns with the same named keys
- Write path: savePartnerMeta merges updates and persists to partners (see src/lib/data/partners.ts)

Partner users (accounts)
- KV: login emails with role and optional partner linkage
- Supabase: partner_users
- Notes
  - role: partner | admin
  - partner_id nullable for admin accounts
  - last_login_at set via touchPartnerUserLogin

Partner invites (onboarding)
- KV: invite token → email, partner, role, name, expiry, used
- Supabase: partner_invites
- Notes
  - token is opaque random hex
  - inviteUrl generated from env DASHBOARD_BASE_URL

Visits (registrations) and members
- KV: visit objects (pending/visited), payload, derived metrics
- Supabase: visit_registrations, plus partner_members
- Key field mapping
  - submissionId → submission_id
  - email (lowercased)
  - partnerId → partner_id (lowercased)
  - status: pending | visited | cancelled
  - payload: jsonb, includes raw/legacy booking payload
  - estimatedPoints → estimated_points
  - pointsAwarded → points_awarded
  - totalPrice → total_price (numeric); numeric strings coerced
  - numPeople → num_people
  - ticketType → ticket_type
  - transport (string)
  - categories (string)
  - visitedAt → visited_at
  - visitNotes → visit_notes
  - legacyQrKey → legacy_qr_key
  - hasRedemption / redemptionCode / redemptionReward / redemptionValue preserved for parity
- Members pivot
  - On visit creation, (partner_id, email) upserted into partner_members to track membership

Points history (balances)
- KV: earned/used/adjustment logs
- Supabase: points_history
- Semantics
  - type: earned adds, redemption subtracts, adjustment adds (sign respected in value)
  - compute user total = Σ(earned + adjustment) − Σ(redemption)

Pending verifications (QR/verify flows)
- KV: short-lived records keyed by rid or email with verify/qr URL
- Supabase: pending_verifications
- Semantics
  - TTL: expires_at set at creation (defaults to 1 hour in /api/pending)
  - Lookup by rid or email, delete by id/rid/email
  - legacy_key preserved for cross-system lookups

Rewards and partner visibility
- KV: reward catalog with partner-specific availability
- Supabase: rewards + reward_partner_visibility (join table)
- Mapping
  - pointsCost → points_cost
  - category: one of discount/freebie/experience/merchandise/other
  - status: active/inactive; deleted_at set when archived
  - availableFor array mapped to rows in reward_partner_visibility

Redemptions (bonus lifecycle)
- KV: redemption code lifecycle (pending → applied → used | rejected)
- Supabase: redemptions
- Mapping & semantics
  - create → status=pending, write points_history(type=redemption, points=reward.pointsCost)
  - apply → status=applied, applied_at set, optional applied_to_visit_id
  - used → status=used, used_at set, partner_id may be set
  - reject → status=rejected
  - expires_at optional; legacy check considers applied AND not expired as valid

---

Endpoint parity and auth

Admin endpoints (admin JWT or x-admin-secret)
- GET /api/admin/overview
- GET /api/admin/analytics
  - CSV columns and ordering aligned with legacy
- GET /api/admin/visits (list)
- GET /api/admin/visits/[id] (detail)
  - Returns normalized visit with partner info and computed fields
- POST/PATCH/DELETE /api/admin/rewards
- GET/POST/DELETE /api/admin/invites
- GET/POST /api/admin/partners (metadata save/list)

Partner endpoints (partner JWT or admin JWT)
- POST /api/partner/visit
  - Creates visit_registrations row (status=pending)
  - Accepts either payload or legacy data field; derives estimated points with legacy rules
- POST /api/partner/mark-visited
  - Resolves visit (by visitId or latest pending), updates to visited
  - Computes awarded points using legacy derivation and writes points_history(earned)
  - Returns kv-compatible shape including totalPointsNow
- GET/POST /api/partner/check-redemption
  - GET: inspect code with legacy validity rules (applied && not expired)
  - POST: partner actions process (used) or reject with partner scoping

Public/user endpoints
- GET /api/bonus/user-points and /api/bonus/user-points-fixed
- POST /api/bonus/redeem-reward
  - Verifies points, optional partner eligibility, creates redemption + points_history(redemption)
- GET/POST/DELETE /api/pending
  - x-pending-token or x-admin-secret required
  - 1-hour expiration default
- POST /api/register and /api/qr/register
  - Parity with legacy registration flows (forwarding or transforming payloads as needed)
- POST /api/tilda-proxy
  - Proxy to KV/Zapier as in legacy integration

Auth and CORS
- Admin
  - x-admin-secret header OR admin JWT (role=admin in JWT payload)
- Partner
  - partner JWT with partnerId; admin JWT also allowed
- Public routes
  - CORS allowed origins via ALLOWED_ORIGIN / DASHBOARD_BASE_URL; per-route overrides exist (e.g., pending)

Environment variables (relevant)
- ADMIN_SECRET: shared secret for admin endpoints
- JWT_SECRET: used to verify admin/partner JWTs
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: server-side Supabase client
- DASHBOARD_BASE_URL: used to build invite URLs
- ALLOWED_ORIGIN: CORS default for most endpoints
- PENDING_ACCESS_TOKEN, PENDING_ALLOWED_ORIGIN: /api/pending controls
- REDEMPTION_PROCESSED_WEBHOOK_URL: optional webhook for partner redemption processing
- ZAPIER_CATCH_HOOK (if used by tilda-proxy)

---

Sample records (for reference)

Visit (visit_registrations)
```json
{
  "id": "d3a3e5f4-...",
  "email": "user@example.com",
  "partner_id": "demo-partner",
  "status": "pending",
  "payload": { "ticket": "Standard", "numPeople": 1 },
  "estimated_points": 10,
  "points_awarded": 0,
  "total_price": 0,
  "num_people": 1,
  "ticket_type": "Standard",
  "transport": null,
  "categories": "",
  "visited_at": null,
  "legacy_qr_key": null,
  "created_at": "2025-10-01T07:00:00.000Z"
}
```

Points history (earned)
```json
{
  "email": "user@example.com",
  "type": "earned",
  "points": 10,
  "partner_id": "demo-partner",
  "partner_name": "Demo Partner",
  "visit_id": "d3a3e5f4-...",
  "meta": { "source": "partner/mark-visited" }
}
```

Redemption
```json
{
  "code": "RDM-1712345678901-ABCDEF1",
  "email": "user@example.com",
  "reward_id": "reward-free-coffee",
  "partner_id": null,
  "status": "pending",
  "created_at": "2025-10-01T07:00:00.000Z",
  "metadata": {}
}
```

---

Verification and parity checks
- Run quick parity assertions with the provided script:
  - npm run parity:check
  - Required envs (example):
    - API_BASE_URL, FRONTEND_ORIGIN
    - ADMIN_SECRET, PARTNER_JWT
    - TEST_EMAIL, TEST_PARTNER_ID
    - REWARD_ID (optional), REDEMPTION_CODE (optional)

Notes
- The codebase normalizes emails and partner IDs to lowercase before writes.
- Hidden partner status is stored as inactive in DB but rendered as hidden at the app layer.
- Numeric inputs from legacy payloads (e.g., totalPrice) are coerced defensively.
