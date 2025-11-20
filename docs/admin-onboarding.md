# Admin Onboarding & Team Management

This guide explains the new self-service admin flows, invite system, and the Supabase changes required to support them.

## 1. Database migrations

Run the following migrations in Supabase (SQL editor or `supabase db remote commit`):

1. `210_visit_registrations_flash_qr.sql` – widens the `visit_registrations.qr_type` check constraint to allow `flash` and `transport` QR types.
2. `220_admin_invites.sql` – creates the `admin_invites` table and adds metadata columns to `partner_users`.

After running them, confirm:

- `admin_invites` exists with indexes on `token` and `(email, accepted_at, expires_at)`.
- `partner_users` has `verified_at`, `last_invited_at`, and `invited_by` columns.

## 2. Self-service admin sign-up

- Navigate to `https://<your-domain>/<locale>/admin/signup`.
- Fill in email, password (min 8 chars), and optional name.
- Upon success the user is logged in automatically and redirected to `/admin/dashboard`.
- Resulting row appears in `partner_users` with `role = 'admin'` and `metadata.origin = "admin_self_signup"`.

### Environment requirements

- `JWT_SECRET` and `JWT_EXPIRES_IN` must be configured (same as the existing login flow).
- `NEXT_PUBLIC_BASE_URL` (or `BASE_URL`) should point to the canonical domain so invite URLs include the correct origin.

## 3. Admin invites

### Sending invites

- Go to `/admin/accounts` (new "Team" tab in the admin navigation).
- Use the "Invite a team member" form. This calls `POST /api/admin/accounts/invite` and returns a shareable invite link.
- The invite appears in the "Pending invites" list. Copy the link or cancel the invite as needed.

### Accepting invites

- Invitees open the link (e.g. `/admin/invite/accept?token=...`).
- They set their password and optionally supply a name.
- On success they are logged in automatically and `partner_users` is populated with `metadata.origin = "admin_invite"` and `invited_by` set to the inviter email.

### API endpoints (for automation)

- `GET /api/admin/accounts/invite` – list invites (admin auth required).
- `POST /api/admin/accounts/invite` – create invite `{ email, name? }`.
- `DELETE /api/admin/accounts/invite/:id` – cancel invite.
- `GET /api/auth/admin/invite?token=...` – fetch invite status.
- `POST /api/auth/admin/invite` – accept invite `{ token, password, name? }`.

## 4. Testing checklist

Run the new Playwright spec:

```bash
bun run test:e2e --grep "admin onboarding"
```

Manual QA (recommended):

1. Self-sign-up: sign up a new admin account, confirm the dashboard loads, and verify the row in Supabase.
2. Invite flow: send an invite, accept it in a fresh browser profile, confirm login succeeds, and the invite disappears from the pending list.
3. Expired invite: manually adjust `expires_at` in Supabase, reload the accept page, and confirm the banner reports the invite as expired.

## 5. Email delivery (optional)

The API currently returns the invite URL to the UI. Hook the `admin_invite_created` log event (or extend the POST handler) to send transactional emails through your preferred provider.

## 6. Security considerations

- Invite tokens are stored hashed (SHA-256) in Supabase.
- Invites expire after 7 days by default; adjust `expiresInHours` when calling the API if needed.
- CSRF protection is enforced via the existing `x-csrf-token` header for invite management requests.

## 7. Future enhancements

- Add rate limiting to the new auth endpoints.
- Surface resend functionality that regenerates tokens for existing invites.
- Hook invite emails to the transactional email service.
