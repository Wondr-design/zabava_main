# Feature Delivery Plan

This roadmap captures the implementation outline for the remaining requirements across the Admin, Partner, Staff, and User experiences. Each section breaks the work down by data, API, UI, and operational tasks so that vertical slices can be delivered without blocking downstream teams.

## 1. Admin Overview & Analytics
- **Data**
  - Materialize daily visit, revenue, and QR activity aggregates (materialized view or scheduled job) to back live counters and trend charts without overloading transactional tables.
  - Extend `qr_events` to tag source channel (portal, partner app, transport) and store city metadata for segmentation.
  - Store bonus program configuration history (feature flags, thresholds) to support toggles and audit trails.
- **API**
  - Expand `/api/admin/analytics` to expose live counters (visits today, active flash deals, QR scans, pending redemptions, active transport services) and segmentation data (by city, program, channel).
  - Add endpoints for QR control actions (invalidate batch, regenerate QR, resend emails) guarded by admin auth.
  - Provide streaming endpoints or Supabase channel subscriptions for live updates on visits, redemptions, and QR scans.
- **UI**
  - Build a live-ops dashboard header with counters, alerting badges, and quick actions (pause flash deal, resend QR).
  - Deliver analytics widgets: city segmentation map, reward monitoring table (top rewards, fraud risk), bonus toggle controls with confirmation flows.
  - Surface alert banner when KPIs breach thresholds (pending redemptions spike, QR failures).
- **Ops**
  - Schedule nightly jobs (via Supabase cron or N8N) to refresh aggregates and deliver summary emails.
  - Instrument logging/alerting for QR control actions and analytics API failures.
  - Document runbook for toggling bonus programs and responding to QR incidents.

## 2. Partner Dashboard Enhancements
- **Data**
  - Capture visit origin metadata (city, campaign, staff member) to support detailed analytics.
  - Store audit trail entries for partner actions (edits, exports, QR downloads).
  - Add privacy flags per visitor (marketing opt-in, GDPR preferences) on visit records.
- **API**
  - Provide `/api/partner/analytics` with visit counts, conversion funnel, export links, and privacy filter toggles.
  - Add audit trail feed endpoint filtered by partner.
  - Secure file export endpoints (CSV/XLSX) with scoped tokens and expiry.
- **UI**
  - Ship analytics tabs (visits over time, city heat map, staff performance) with filtering and export buttons.
  - Implement privacy filters (hide personal fields, anonymize emails) with visual indicators.
  - Expose audit log timeline and “Download export” CTA that tracks usage.
- **Ops**
  - Configure automated GDPR deletion workflows (N8N + Supabase) triggered by partner requests.
  - Support alerting when partners exceed export thresholds or toggle privacy settings.
  - Update partner onboarding guide with analytics and privacy tooling instructions.

## 3. Staff Console Controls
- **Data**
  - Ensure flash-deal configuration includes minimum visitor thresholds and immutable pricing snapshots.
  - Track staff actions (price overrides attempted, bonuses granted) with immutable log entries.
  - Persist bonus-only visit flows with metadata indicating exemption from standard pricing.
- **API**
  - Validate flash-deal minimums on `/api/staff/visits` mutations; reject if constraints not met.
  - Add endpoints to fetch immutable pricing bundles and enforce on visit updates.
  - Provide staff-only QR validation API that checks bonus eligibility and flash-deal constraints atomically.
- **UI**
  - Update staff console forms to lock price inputs when deal requires immutability; show context tooltips.
  - Introduce warnings for flash-deal minimum violations and inhibit confirmation until resolved.
  - Add bonus-only flow wizard with clear messaging and post confirmation receipts.
- **Ops**
  - Deliver staff training materials covering new enforcement rules.
  - Monitor logs for override attempts; raise alerts when thresholds exceeded.
  - Backfill historical visits with pricing snapshots to align with immutable pricing policy.

## 4. User-Facing Site Refresh
- **Data**
  - Incorporate transport service metadata (cities served, pricing) into public catalog tables.
  - Store GDPR compliance preferences and cookie consent records linked to user sessions.
  - Version bonus content to allow A/B tests on redesigned pages.
- **API**
  - Publish `/api/site/bonus` endpoints for redesigned flows (hero content, reward highlights, flash-deal integration).
  - Add transport service listing APIs with locale-aware filtering and availability.
  - Surface GDPR compliance status via endpoint consumed by consent banner and settings.
- **UI**
  - Redesign bonus landing with hero, featured rewards, and animated filters tied to locale-aware routes.
  - Implement flash-deal browsing journey (deal cards, QR generation, countdown timers).
  - Build transport service pages (compare rides, request flows) and animated home filters.
  - Introduce GDPR consent banner, preference center, and updated privacy notices.
- **Ops**
  - Localize new content (CS/EN) and integrate with translation workflow.
  - Run accessibility and performance audits on redesigned pages pre-launch.
  - Align GDPR documentation with new consent features; schedule legal review.

## 5. Reporting & Invoicing
- **Data**
  - Extend reporting schema to capture flash-deal usage, transport rides, and commission calculations.
  - Store N8N webhook delivery logs and response statuses for reconciliation.
  - Maintain partner billing configuration (rates, currencies, cadence) centrally.
- **API**
  - Ship `/api/admin/reports/flash-deals` and `/api/admin/reports/transport-usage` with CSV/XLSX outputs.
  - Expose webhook status endpoint for N8N integrations (retry, acknowledge).
  - Add background job endpoints to regenerate invoices and resend exports.
- **UI**
  - Embed reporting dashboard with filters, export buttons, and N8N delivery status badges.
  - Provide partner-facing invoice history with download links and status indicators.
  - Include flash-deal vs standard revenue comparison charts.
- **Ops**
  - Automate report generation schedule (weekly/monthly) and delivery to N8N.
  - Monitor webhook failures; implement retry & alert pipeline.
  - Document billing reconciliation process and integrate with finance tooling.

## Immediate Next Steps
1. Finalize analytics live-counter metrics (in progress: live counters & QR activity).
2. Audit Supabase indexes to ensure new analytics queries remain performant.
3. Sequence vertical slices (admin analytics → partner privacy → staff enforcement → user redesign → reporting) and create Jira/Linear tickets per section.
