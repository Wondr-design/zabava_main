# Engineering Update: Locale Routing, Supabase Typing, and Admin Analytics

## Locale-Aware Navigation
- All partner, staff, and admin app-router pages now live under `src/app/[locale]/…`. Internal links use `LocalizedLink`, `useLocalizedRouter`, or `buildLocalizedPath`, which keeps language prefixes intact when the user navigates or we redirect programmatically.
- If you add new pages, drop them under the `[locale]` tree and rely on the shared helpers—avoids hard-coding `/en` or `/cs` and makes future locale additions straightforward.
- Middleware enforces auth/role guards after stripping the locale segment, so middleware updates should continue to work across languages without additional conditionals.

## Typed Supabase Access
- `getSupabaseAdminTyped` wraps the existing service-role client with the generated `Database` types (`src/lib/supabase-admin.ts`). Modules that import it (e.g. `src/lib/data/flash-deals.ts`) now get typed `.insert()`/`.update()` payloads without `as unknown` casts.
- `src/supabase/types.ts` keeps explicit definitions for the tables we’ve migrated (flash deals, transport) and falls back to a `GenericTable` for everything else. As we type more tables, add them to that file and switch the relevant data helpers over to `getSupabaseAdminTyped`.
- ESLint runs clean after replacing `any` placeholders with `unknown`, so we’ll keep the stricter rule enabled.

## Admin Analytics Enhancements
- `/api/admin/analytics` now aggregates QR event stats over the last 24 hours and returns them alongside the existing visit/bonus metrics.
- The dashboard page renders two new card groups: one summarising generated/scanned/redeemed/expired counts, another breaking events down by QR programme (standard, bonus, flash, transport). Both cards hydrate from the same API payload, so extending the endpoint automatically updates the UI.
- `getQrEventStats` centralises the Supabase query logic and reuses a typed base query, avoiding `any` escapes and keeping the aggregation in one place.

## Build & Tooling Notes
- Removed the stray root `package-lock.json` and set `outputFileTracingRoot` in `next.config.ts` so Next.js stops inferring `/Users/wondr` as the workspace root.
- `bun run build` and `bun run lint` pass without warnings. If you introduce another workspace above this repo, update `outputFileTracingRoot` or make it configurable via an env var.

## Suggested Follow-Ups
1. Continue migrating the remaining data modules to the typed Supabase helper—prioritise rewards, visits, and points so the supabase schema stays the single source of truth.
2. Wire the QR analytics summary into alerting (e.g. Sonner toasts or Ops emails) when scans spike or drops occur—foundation is there, just need thresholds.
3. Record these patterns in the team playbook so future locale-aware routes or Supabase tables follow the same conventions.
