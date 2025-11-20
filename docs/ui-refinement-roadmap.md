# UI Refinement Roadmap

Target: bring Zabava’s web consoles in line with the second dashboard reference (DocuVault-style) while maintaining the shared design-system tokens and Supabase-backed data flows.

## 1. Foundations (Week 1)

- **Design tokens**: extend `design-system.css` with spacing elevations, semantic accent tiers, neutral greys, and chart palettes that match the reference. Add CSS variables for partner/staff accent colour overrides resolved from Supabase.
- **Layout primitives**: introduce shared `DashboardShell`, `DashboardHeader`, `StatCard`, `DataCard`, and `KeyValueList` components under `src/components/ui/dashboard`. Each shell should support breadcrumb slots, quick actions, and contextual metadata blocks similar to the inspiration UI.
- **Typography & iconography**: standardise on 14px body, 20px section headers, and 32px page titles. Create an icon map using `lucide-react` icons sized to 18px/20px for nav items and 32px for hero cards.

## 2. Shared Behaviour Enhancements (Week 1-2)

- **Accent + theme application**: build a `useWorkspaceTheme` hook that reads the active admin/partner/staff profile (leveraging `settingsApi.*.get`) and applies CSS custom properties (`--workspace-accent`, `--workspace-surface`) at the shell level so saved preferences instantly restyle the UI.
- **Header search + quick actions**: refactor the inactive search bar in `AdminShell` and partner/staff headers into a reusable component with optional autocomplete source. Provide quick action buttons (Upload/Create) mirroring reference CTAs.
- **Skeleton states**: create skeleton presets for stat cards, data tables, and timeline feeds to avoid white flashes during Supabase fetches.

## 3. Admin Console Alignment (Week 2)

- **Navigation**: widen sidebar to 280px, add section labels (“Operations”, “Insights”), and swap list-style nav for pill-based entries with status dots. Integrate active accent colour from the admin profile into hover/active states.
- **Dashboard hero**: redesign `AdminDashboardPage` header to include stats overview, date range filter, and compact quick actions row (e.g., “Add visit”, “Invite partner”).
- **Cards**: port `StatsGrid` to use new `StatCard` component with icon badges and progress bars similar to DocuVault. Update `RecentVisitsTable` container to include filter pills and inline avatars.
- **Secondary pages**: apply consistent layout to partners, visits, rewards, and invites pages using the new shell, ensuring table headers, filter panels, and right-side detail drawers echo the reference design.

## 4. Partner Console Alignment (Week 3)

- **Header**: replace current top bar with shell that features partner logo badge, last sync timestamp, and action buttons (`+ Register visit`, `Download report`).
- **Quick access strip**: convert existing metrics chips into carousel of “cards” (icon + label + meta) to mimic the horizontal quick access seen in the reference image.
- **Analytics section**: rework submissions table to include segmented controls (All / Visited / Pending) and inline summary bar chart using `recharts` to mirror DocuVault’s filter chips + colourful toolbar.
- **Staff management integration**: embed shortcut to `PartnerStaffPage` inside dashboard quick access, showing headcount and pending invites.

## 5. Staff Console Alignment (Week 3-4)

- **Shell**: transition from top-only nav to two-column layout with a lightweight sidebar (queue, redemptions, settings) mirroring the reference’s left rail.
- **Queue view**: redesign cards to feature avatars, visit code, and elapsed time chips with accent colour states.
- **Activity timeline**: add right-hand panel summarising latest redemptions/visits using a timeline component similar to the source image’s activity feed.
- **Dark theme polish**: ensure staff theme tokens produce high contrast backgrounds and drop shadows akin to the DocuVault dark panels.

## 6. Integration & QA (Week 4)

- **Apply saved settings**: confirm Supabase profiles update shell accents and logos live (use optimistic updates + toasts; fall back to server values after Supabase writes).
- **Accessibility audit**: run axe checks, ensure colour contrast meets WCAG AA, and add keyboard focus styles for nav/sidebar interactions.
- **Regression sweep**: execute `npm run lint`, component snapshot tests (add Vitest or Storybook visual checks), and smoke e2e flows (Playwright) across admin/partner/staff consoles.
- **Documentation**: update `README.md` with screenshots, theme override instructions, and new component usage notes for contributors.

## Sequencing Notes

- Prioritise foundational work before page-specific refactors to avoid duplicating styles.
- Implement shells per console (admin first) to validate theme propagation before adjusting internal cards/tables.
- Use feature flags (environment-based) if we need to stage rollouts incrementally.

Deliverables from this roadmap include reusable UI primitives, updated shell layouts for all consoles, accent-aware styling wired to Supabase, and refreshed data presentation components consistent with the DocuVault-inspired design.
