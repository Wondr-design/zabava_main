# Endpoint parity checklist

Purpose

- Provide a concise mapping between legacy KV endpoints/semantics and the current Supabase-backed API routes in this Next.js app.
- Capture methods, auth, expected requests/responses, CORS, and any notable parity notes to support maintenance and QA.

Legend

- Auth: Admin = x-admin-secret or Admin JWT; Partner = Partner JWT or Admin JWT; Public = no auth required.
- CORS: Defaults from withCors/applyCors or per-route overrides.

Admin endpoints

1. GET /api/admin/overview

- Auth: Admin
- Purpose: Summary metrics (active/pending partners, month visits, today generated/visited, revenue, etc.)
- Response: { totals, quickActions }
- Notes: Uses Supabase aggregates; parity with legacy dashboard summary.

2. GET /api/admin/analytics?mode=metrics|submissions|export[&partnerId][&search][&limit]

- Auth: x-admin-secret
- Methods: GET, OPTIONS
- Modes:
  - metrics: totals, revenueTrend, latestSubmissions, partners
  - submissions: paged list with normalized fields, filter by partnerId/search
  - export: CSV attachment with ordered columns matching legacy
- Notes: CSV escaping and column ordering aligned to legacy expectations

3. GET /api/admin/visits?email=&partnerId=&status=&limit=

- Auth: Admin
- Purpose: Filtered list of visit_registrations for admin views
- Response: { items }

4. GET /api/admin/visits/[id]

- Auth: Admin
- Purpose: Detailed visit view with normalized object for inspection
- Response: { visit, normalized }

5. GET /api/admin/rewards

- Auth: x-admin-secret
- Response: { rewards, statistics }
- Notes: Partner visibility loaded from reward_partner_visibility

6. GET /api/admin/rewards/:id

- Auth: x-admin-secret
- Response: { reward, statistics }

7. POST /api/admin/rewards

- Auth: x-admin-secret
- Body: { name, description?, pointsCost, category, availableFor?, stock?, imageUrl?, redemptionInstructions?, validUntil?, status? }
- Response: Reward

8. PUT /api/admin/rewards/:id

- Auth: x-admin-secret
- Body: partial update of fields above
- Response: Reward

9. DELETE /api/admin/rewards/:id

- Auth: x-admin-secret
- Behavior: soft-archive (status=inactive, deleted_at set) and clear visibility rows
- Response: { success: true, id }

10. GET /api/admin/invites?cursor=&limit=

- Auth: Admin
- Response: { items, nextCursor }

11. POST /api/admin/invites

- Auth: Admin
- Body: { email, partnerId, role, name?, expiresInMinutes? }
- Response: { invite }

12. GET /api/admin/partners?partnerId=&status=&search=

- Auth: Admin
- Response: { items } or { item } if partnerId specified

13. PUT /api/admin/partners?partnerId={id}

- Auth: Admin
- Body: partnerMetaUpdateSchema (status/contract/ticketing/info/media/bonusProgramEnabled/notes)
- Response: PartnerMeta

14. GET /api/admin/accounts

- Auth: Admin
- Response: { items: [{ email, role, partnerId, name, createdAt, lastLoginAt }] }

15. POST/PUT /api/admin/accounts

- Auth: Admin
- Body: { email, password, partnerId?, role, name? }
- Response: { success, email, partnerId, role, name }

Partner endpoints

1. GET /api/partner/[id]

- Auth: Partner(Admin allowed); partnerId in path must match JWT partnerId unless admin
- Response: { submissions, metrics, partner, partnerId, lastUpdated }
- Notes: Similar to legacy partner dashboard endpoint.

2. POST /api/partner/visit

- Auth: Partner(Admin allowed)
- Body: { email, partnerId, payload? or legacy data?, estimatedPoints?, totalPrice?, numPeople?, ticketType?, transport?, categories? }
- Behavior: Creates visit_registrations (status=pending), derives estimated points with legacy rules
- Response: { success, email, partnerId, estimatedPoints, status, createdAt, visitId }

3. POST /api/partner/mark-visited

- Auth: Partner(Admin allowed)
- Body: { email, partnerId, visitId?, visitDate?, notes? }
- Behavior: Resolve visit (visitId or latest pending), compute awarded points via legacy logic, update to visited, write points_history(earned)
- Response: { success, message, visit: { email, partnerId, visitedAt, pointsAwarded, estimatedPoints, totalPrice, ticketType, numPeople, transport, categories, visitId, submissionId, totalPointsNow } }

4. GET /api/partner/check-redemption?code=

- Auth: Optional; Partner(Admin allowed)
- Behavior: Inspect redemption code state; legacy valid = applied && not expired
- Response: { redemption, reward, booking?, isValid, canProcess }

5. POST /api/partner/check-redemption

- Auth: Partner(Admin allowed)
- Body: { code, action: 'process' | 'reject' }
- Behavior: Marks redemption used or rejected; optional webhook
- Response: success response with status and timestamps

Public/user endpoints

1. GET /api/bonus/user-points?email=

- Auth: Public
- Response: { user: { totalPoints, availablePoints }, visits: [...], statistics, availableRewards }

2. GET /api/bonus/user-points-fixed?email=

- Auth: Public
- Response: Fixed variant without reward visibility; { user, visits, statistics }

3. GET /api/bonus/debug-user?email=

- Auth: Public (diagnostic)
- Response: { email, qrRecords, partnerMemberships, pointsHistory, redemptions }

4. POST /api/bonus/redeem-reward

- Auth: Public
- Body: { email, rewardId, partnerId? }
- Behavior: Validates available points and partner eligibility; creates redemptions row and points_history(redemption)
- Response: { success, message, redemption: { code, rewardName, pointsSpent, partnerId, expiresAt } }

5. GET/POST/DELETE /api/pending

- Auth: x-pending-token or x-admin-secret
- GET: ?rid= or ?email=; returns record
- POST: { rid?, email?, verifyUrl or qrUrl, visitId?, key? } with 1-hour expiry
- DELETE: ?rid= or ?email=; deletes matching

6. POST /api/register

- Auth: Public
- Body: { email, partnerId?, data? } and any extra KV-legacy keys
- Behavior: Derives partnerId and metrics from payload, creates visit_registrations (pending)
- Response: { success, email, verifyUrl?, key?, message }

7. POST /api/qr/register

- Auth: Public
- Body: { email, partnerId?, redemptionCode?, data?, ...legacy fields }
- Behavior: Generates visitId and legacyQrKey, merges data, creates visit_registrations (pending)
- Response: { success, message, visit: { id, email, partnerId, estimatedPoints, status, createdAt, verifyUrl } }

8. GET /api/verify?visitId= or ?email= or ?rid=

- Auth: Public (HTML)
- Purpose: Human-readable confirmation page for registrations/visits
- Response: HTML page with QR/visit summary and recent points history

9. GET /api/tilda-proxy (health) and POST /api/tilda-proxy

- Auth: Public
- POST Body: Any payload from Tilda
- Behavior: Forwards to /api/register locally; optionally forwards to Zapier hook with augmented payload
- Response: { ok, registered, registerResult, forwardedToZapier }

10. GET /api/health and GET /api (root)

- Auth: Public
- Response: { status: 'ok' }

Auth notes

- Admin: either x-admin-secret or admin JWT (role=admin)
- Partner: partner JWT (with partnerId) or admin JWT
- Public: no auth

CORS notes

- Most JSON endpoints use withCors/applyCors with origin from ALLOWED_ORIGIN or DASHBOARD_BASE_URL; pending has its own allowed origin.

Parity deviations

- Hidden partner status stored as inactive in DB; rendered as hidden in app logic
- user-points-fixed is a simplified, stable variant without reward availability logic
- CSV export ensures stable column ordering and escaping; may include additional columns if present in DB payload

Verification

- Run: npm run parity:check
- Required envs: API_BASE_URL, FRONTEND_ORIGIN, ADMIN_SECRET, PARTNER_JWT, TEST_EMAIL, TEST_PARTNER_ID, REWARD_ID?, REDEMPTION_CODE?
