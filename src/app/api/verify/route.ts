import { NextRequest, NextResponse } from 'next/server';
import { listVisitsForEmail, getVisitById } from '@/lib/data/visits';
import { getPointsHistoryForEmail, getTotalPointsForEmail } from '@/lib/data/points';
import { getPendingByRid } from '@/lib/data/pending';

const ZAPIER_HOOK = process.env.ZAPIER_HOOK || '';
const REGEN_LINK = process.env.REGEN_LINK || 'https://example.com/regenerate';

function escapeHtml(input: unknown) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function renderHtml({
  status,
  title,
  subtitle,
  rows,
  footer,
}: {
  status: 'success' | 'error' | 'info';
  title: string;
  subtitle?: string;
  rows: Array<{ label: string; value: string }>;
  footer?: string;
}) {
  const statusMeta = {
    success: { label: 'Verified', className: 'badge badge--success' },
    info: { label: 'Notice', className: 'badge badge--info' },
    error: { label: 'Attention', className: 'badge badge--error' },
  }[status];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} · Zabava</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #020617;
        --card: rgba(15, 23, 42, 0.8);
        --border: rgba(148, 163, 184, 0.25);
        --text: #f8fafc;
        --muted: #94a3b8;
      }
      *, *::before, *::after { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: clamp(20px, 4vw, 48px);
        background:
          radial-gradient(120% 120% at 50% 0%, rgba(56, 189, 248, 0.12), transparent 60%),
          linear-gradient(160deg, rgba(2, 6, 23, 0.95), rgba(15, 23, 42, 0.95));
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: var(--text);
      }
      .card {
        width: min(800px, 100%);
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 28px;
        padding: clamp(24px, 4vw, 44px);
        backdrop-filter: blur(18px);
        box-shadow: 0 48px 80px rgba(2, 6, 23, 0.4);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        font-size: 0.68rem;
        padding: 6px 14px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: rgba(148, 163, 184, 0.1);
        color: rgba(226, 232, 240, 0.78);
        margin-bottom: 12px;
      }
      .badge--success { border-color: rgba(74, 222, 128, 0.3); color: #4ade80; background: rgba(34, 197, 94, 0.18); }
      .badge--info { border-color: rgba(59, 130, 246, 0.3); color: #60a5fa; background: rgba(59, 130, 246, 0.18); }
      .badge--error { border-color: rgba(248, 113, 113, 0.3); color: #f87171; background: rgba(248, 113, 113, 0.18); }
      h1 { margin: 0 0 12px; font-size: clamp(1.9rem, 1.2vw + 1.6rem, 2.4rem); }
      p.subtitle { margin: 0 0 24px; color: var(--muted); }
      .details { display: flex; flex-direction: column; gap: clamp(12px, 1.6vw, 20px); }
      .row {
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 18px;
        padding: clamp(14px, 1.4vw, 20px);
        background: rgba(148, 163, 184, 0.08);
      }
      .row__label {
        font-size: 0.68rem;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(148, 163, 184, 0.78);
        margin-bottom: 8px;
      }
      .row__value { font-size: 1rem; line-height: 1.55; font-weight: 500; }
      footer { margin-top: clamp(18px, 2vw, 28px); color: var(--muted); font-size: 0.9rem; }
      footer a { color: #38bdf8; }
    </style>
  </head>
  <body>
    <main class="card">
      <span class="badge ${statusMeta.className}">${statusMeta.label}</span>
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
      <section class="details">
        ${rows
          .map(
            (row) => `
              <div class="row">
                <div class="row__label">${escapeHtml(row.label)}</div>
                <div class="row__value">${row.value}</div>
              </div>`
          )
          .join('\n')}
      </section>
      ${footer ? `<footer>${footer}</footer>` : ''}
    </main>
  </body>
</html>`;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const visitId = url.searchParams.get('visitId')?.trim();
  const email = url.searchParams.get('email')?.trim().toLowerCase();
  const rid = url.searchParams.get('rid')?.trim();

  if (!visitId && !email && !rid) {
    return new NextResponse(
      renderHtml({
        status: 'error',
        title: 'Missing information',
        subtitle: 'Provide a visitId, email, or rid to verify a booking.',
        rows: [
          { label: 'Usage', value: 'Add query parameters like ?visitId=... or ?email=...' },
        ],
      }),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  try {
    let visit = null;

    if (visitId) {
      visit = await getVisitById(visitId);
    }

    if (!visit && email) {
      const visits = await listVisitsForEmail(email, 1);
      visit = visits[0] ?? null;
    }

    if (!visit && rid) {
      const pending = await getPendingByRid(rid);
      if (pending?.visit_id) {
        visit = await getVisitById(pending.visit_id);
      }
    }

    if (!visit) {
      return new NextResponse(
        renderHtml({
          status: 'error',
          title: 'QR code not found',
          subtitle: 'We could not locate a matching registration.',
          rows: [
            {
              label: 'Need help?',
              value: `<a href="${escapeHtml(REGEN_LINK)}">Tap here to regenerate</a>`,
            },
          ],
        }),
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const totalPoints = await getTotalPointsForEmail(visit.email);
    const history = await getPointsHistoryForEmail(visit.email, 5);

    const rows = [
      { label: 'Email', value: escapeHtml(visit.email) },
      { label: 'Partner', value: escapeHtml(visit.partner_id ?? 'Not assigned') },
      {
        label: 'Status',
        value: escapeHtml(
          visit.status === 'visited'
            ? 'Visited'
            : visit.status === 'cancelled'
            ? 'Cancelled'
            : 'Pending'
        ),
      },
      {
        label: 'Registered',
        value: escapeHtml(formatDate(visit.created_at) ?? '—'),
      },
      {
        label: 'Visited',
        value: escapeHtml(formatDate(visit.visited_at) ?? 'Not yet confirmed'),
      },
      {
        label: 'Estimated Points',
        value: escapeHtml(String(visit.estimated_points ?? 0)),
      },
      {
        label: 'Total Points Earned',
        value: escapeHtml(String(totalPoints)),
      },
      {
        label: 'Recent Activity',
        value:
          history.length === 0
            ? '<span class="muted">No recent point events.</span>'
            : history
                .map(
                  (entry) => `${escapeHtml(entry.type)} · ${escapeHtml(entry.points)} pts · ${escapeHtml(
                    formatDate(entry.created_at) ?? ''
                  )}`
                )
                .join('<br />'),
      },
    ];

    const footerParts = [] as string[];
    if (rid) {
      const pending = await getPendingByRid(rid);
      if (pending?.verify_url) {
        footerParts.push(
          `Latest verification link: <a href="${escapeHtml(pending.verify_url)}">${escapeHtml(
            pending.verify_url
          )}</a>`
        );
      }
    }

    if (REGEN_LINK) {
      footerParts.push(`Need a new QR? <a href="${escapeHtml(REGEN_LINK)}">Regenerate here</a>.`);
    }

    if (ZAPIER_HOOK) {
      footerParts.push('Automated notifications enabled.');
    }

    return new NextResponse(
      renderHtml({
        status: visit.status === 'visited' ? 'success' : 'info',
        title:
          visit.status === 'visited'
            ? 'Visit confirmed'
            : 'QR registration found',
        subtitle:
          visit.status === 'visited'
            ? 'This visitor has already been marked as visited.'
            : 'Awaiting confirmation from partner.',
        rows,
        footer: footerParts.join(' '),
      }),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (err) {
    console.error('verify error', err);
    return new NextResponse(
      renderHtml({
        status: 'error',
        title: 'Unexpected error',
        subtitle: 'Something went wrong while loading the QR information.',
        rows: [{ label: 'Details', value: 'Please try again later or contact support.' }],
      }),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
