# Special & Flash Deals – Sprint 0 Technical Design

This document captures the implementation blueprint for the Special & Flash Deals programme. It scopes database changes, APIs, front-end surfaces, automation, and open items so we can start Sprint 1 (data foundation) with clarity.

---

## 1. Domain Overview

- **Deal types** share one data model. Variants are represented by a `deal_type` field: `"flash"`, `"weekly_promo"`, `"group"`, etc.
- **Bonus policy**: every `deal_type` is excluded from bonus redemption/earnings.
- **Single source of truth**: Admin console controls creation/editing. Public site and APIs read directly from the same data.
- **Reminders**: handled via n8n. Our system provides endpoints and metadata (next-reminder window, email payload). n8n orchestrates sends and retries.
- **Reporting**: CSV export endpoints only (no BI integrations).

---

## 2. Data Model (Supabase)

### 2.1 Tables

**`deals` (new)**
| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID | PK |
| `deal_type` | text | `"flash"`, `"weekly_promo"`, `"group"` |
| `partner_id` | text | FK to partners table (existing `partner_profiles`/`partners`) |
| `title` | text | |
| `slug` | text | for public URLs |
| `description` | text | optional detailed copy |
| `status` | text | `"draft"`, `"scheduled"`, `"active"`, `"paused"`, `"expired"` |
| `starts_at` / `ends_at` | timestamptz | deal validity window |
| `valid_days` | int[] | days of week (0–6) – optional |
| `min_visitors` | int | enforced in QR generation + staff console |
| `ticket_type_ids` | uuid[] | references partner ticket catalogue (if available) |
| `discount_percent` | numeric | stored as decimal (0–100) |
| `price_override_czk` | numeric | optional flat price |
| `bonus_override` | numeric | points to award (for non-flash deals) |
| `commission_percent` | numeric | custom commission; null => partner default |
| `qr_validity_seconds` | int | default 864000 (10 days) |
| `usage_limit_total` | int | optional |
| `usage_limit_daily` | int | optional |
| `auto_expire` | boolean | toggle for checking expiry window |
| `send_reminders` | boolean | toggle for n8n reminder flow |
| `tags` | text[] | e.g. `["Hot","EndingSoon"]` |
| `audience` | text[] | `["Kids","Teens","Family"]` |
| `city` | text | optional for filter |
| `created_by` / `updated_by` | text | admin user IDs |
| `created_at` / `updated_at` | timestamptz | default now |

**`deal_media`**

- `deal_id` (FK)
- `media_type` (`"image"`, `"video"`)
- `url`
- `alt_text`
- `sort_order`

**`deal_usage_stats`**

- `deal_id` (FK)
- `qr_generated` (int)
- `qr_scanned` (int)
- `qr_rejected` (int)
- `commission_czk` (numeric)
- `bonus_awarded` (numeric)
- Last updated timestamp.

**`deal_qr_events`** (optional, can reuse existing `qr_events` if we add `deal_id` column)

- `deal_id`
- `qr_id`
- `event_type` (`generated/scanned/rejected/expired/reminder_sent`)
- `metadata` (jsonb)
- Timestamps.

**`deal_reminder_queue`**

- `deal_id`
- `qr_id`
- `user_email`
- `reminder_type` (`day3`, `pre-expiry`)
- `scheduled_at`
- `status` (`pending`, `sent`, `failed`)
- `last_attempt_at`

> **Migration plan**: add `deal_id` to existing `qr_events` so we can reuse analytics; evaluate if `visit_registrations` requires new columns for discounted price and deal metadata.

### 2.2 Supabase Typings

- Extend `src/supabase/types.ts` to include new tables/columns.
- Update `getSupabaseAdminTyped` consumer modules after migrations.

---

## 3. Backend & API

### 3.1 Admin API

- `GET /api/admin/deals?status=&type=&partnerId=&search=`  
  Returns paginated list including usage stats, reminder settings, tags.
- `POST /api/admin/deals`  
  Body matches create form. Auto-generates slug, sets initial status.
- `GET /api/admin/deals/[id]`  
  Full detail with media, stats, audit log.
- `PUT /api/admin/deals/[id]`  
  Update fields, handle status transitions.
- `POST /api/admin/deals/[id]/duplicate`
- `POST /api/admin/deals/[id]/disable`
- `POST /api/admin/deals/[id]/preview` -> returns signed URL/QR sample.
- `GET /api/admin/deals/export?type=&from=&to=` -> CSV export.

### 3.2 Public API

- `GET /api/special-offers?city=&audience=&tag=`  
  Returns active deals with minimal fields for listing.
- `GET /api/special-offers/[slug]`  
  Detailed view (media, rules, price calculator data).
- `POST /api/special-offers/[slug]/generate`  
  Request body: `{ visitors, email, consentMarketing }`.  
  Validates min visitors, valid day/dates, usage limits, active status.  
  Creates QR entry with 10-day expiry, returns payload for display/email.

### 3.3 Staff API

- Extend existing `/api/staff/visit/[id]` to include deal metadata (min visitors, discount, scan validity).  
  On confirm: enforce conditions -> mark visit, log commission, skip bonus.  
  On reject: record reason (`min_visitors_not_met`, `expired`, etc.).

### 3.4 Partner API

- Extend `/api/partner/visit` or analytics endpoint to return deal details for reporting.
- Allow CSV export filtered by deal type/date.

### 3.5 Reminder webhook (n8n)

- `POST /api/deals/reminders/queue` -> triggered nightly to enqueue upcoming reminders.
- `POST /api/deals/reminders/dispatch` -> invoked by n8n with list of reminders to mark as sent/failed.
- Provide sample payload for n8n flow:
  ```json
  {
    "qrId": "uuid",
    "dealId": "uuid",
    "userEmail": "user@example.com",
    "reminderType": "day3",
    "expiresAt": "2025-01-14T10:00:00Z",
    "dealTitle": "Midweek Bowling Flash Deal",
    "partnerName": "Bowling City",
    "minVisitors": 4
  }
  ```

### 3.6 Validation rules

- Minimum visitors enforced server-side for QR generation and again in staff console.
- QR generation limited to one active QR per deal per user (until expiry or usage).
- Valid days/dates checked on generation AND scan.
- Auto-expire job marks past `ends_at` deals as expired and triggers final reminder if enabled.

---

## 4. Frontend Implementation Plan

### 4.1 Public site (`/special-flash-deals`)

- Hero + filter bar (city, audience, tags, `deal_type`).
- Table view (desktop) with columns: Partner, Offer, Valid Until, QR Type, Action.
- Card grid (mobile) with quick CTA, badges, Bonus-not-eligible icon.
- “More Info” modal/route showing:
  - Carousel of images/videos.
  - Rules list (min visitors, valid days).
  - Countdown timer (using `ends_at` + `qr_validity_seconds`).
  - Dynamic price calculator: min visitors default, stepper for additional visitors (if allowed).
  - CTA: Generate QR (prefills min visitors).
- QR generation flow:
  - Step 1: form (visitors >= min, email, GDPR checkbox, optional marketing opt-in).
  - Step 2: confirmation (QR preview, instructions).
  - Show note: “Staff will decline if fewer visitors arrive or outside valid days.”

### 4.2 Staff console

- Scan view enhancements: new badge, summary panel with required visitors & valid window.
- Confirm checkbox: “I confirm the required number of visitors is present and today is a valid day.”  
  Must be checked to enable Confirm button.
- If rejection: prompt to pick reason (min visitors, expired).

### 4.3 Partner dashboard

- Update visits table to include:
  - `qr_type` (standard/bonus/flash/weekly promo, etc.)
  - `visitors`
  - `original_price`, `discounted_price`
  - `bonus_awarded` (expected zero for deals)
  - `commission_czk`
- Export button -> calls partner analytics export endpoint.

### 4.4 Admin console

- New page `/admin/deals` under navigation (before flash deals? or replace?).  
  Possibly restructure nav to “Deals” -> “Flash/Special”.
- List view:
  - Columns: Partner, Title, Type, Status, Start, End, QR generated/used, usage limits.
  - Sticky filters (status, type, partner).
  - Quick actions (Preview, Edit, Duplicate, Disable).
- Analytics summary cards (top): QR generated, confirmed scans, commission, reminders sent.
- Creation form:
  - Multi-step or single page with sections:
    1. Basics (title, type, partner, status toggle).
    2. Schedule (dates, valid days).
    3. Rules (min visitors, ticket types, discount %, price overrides).
    4. Commission & bonus override.
    5. Messaging (description, tags, audience, city, media uploads).
    6. Limits & automation (usage limits, reminders toggle, auto-expire).
  - Validation for required fields per type (e.g., flash deals enforce min visitors).
- Reminder settings display/historic counts (pull from `deal_reminder_queue`).

---

## 5. Automation & Reminder Flow

1. Nightly job (Supabase cron or scheduled serverless) calls `/api/deals/reminders/queue` to enqueue events for day-3 and pre-expiry.
2. n8n fetches `pending` reminders via webhook or scheduled request, sends email, and POSTs results back to `/api/deals/reminders/dispatch`.
3. System updates `deal_reminder_queue.status` to `sent` or `failed`.
4. Reminders disabled (`send_reminders = false`) skip queueing.

Fallback: If n8n is unreachable, queue remains pending; next run will retry. Admin analytics should display counts of pending/failed reminders.

---

## 6. Analytics & Reporting

- Reuse/enhance `deal_usage_stats` for quick metrics (increment counters on QR generation/scan) via Supabase function or server-side update.
- Admin export:
  - CSV columns: deal info, QR id, user email (maybe hashed), visitors, status, generated/used at, commission, reminder status.
- Partner export:
  - Similar but omit user email; include final price and commission.

---

## 7. Security & Compliance

- Ensure all endpoints validate admin/staff tokens.
- Public QR generation rate-limited per IP/email to prevent abuse.
- GDPR: consent flags stored per QR; marketing opt-in forwarded to whichever system handles newsletters (scope TBD).
- Bonus exclusion enforced in service layer (no accidental points).

---

## 8. Open Questions / TODOs

1. **Reminder email copy**: need final content + localization for n8n.
2. **Partner ticket integration**: confirm if `ticket_type_ids` is available or if we work with plain strings.
3. **Homepage banners**: design & placement (component + toggles in admin).
4. **Deal duplication**: ensure duplicated deals reset usage counters & reminders.
5. **Monitoring**: decide on logging/alerting (e.g., Sentry events when reminder dispatch fails).

---

## 9. Next Steps

1. Review this spec with product/design/ops; capture answers for open items.
2. Prepare Supabase SQL migrations and TypeScript type updates.
3. Kick off Sprint 1 (Data foundation + admin list endpoint) once approved.

This doc will serve as the baseline for implementation tickets (Linear/Jira). Adjust as requirements evolve.
