"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { partnerApi } from '@/lib/web/api-client';
import { StaffTable, StaffListItem } from '@/components/partner/staff-table';
import { StaffInviteForm } from '@/components/partner/staff-invite-form';
import { StaffInviteTable, StaffInviteItem } from '@/components/partner/staff-invite-table';
import { StaffCreateForm } from '@/components/partner/staff-create-form';

type StaffListResponse = { items?: StaffListItem[] };
type StaffInviteListResponse = { items?: StaffInviteItem[] };
type PartnerDashboardResponse = { partner?: string };

function getCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [k, v] = cookie.trim().split('=');
    if (k === name && v !== undefined) return decodeURIComponent(v);
  }
  return '';
}

export default function PartnerStaffPage() {
  const router = useRouter();
  const [partnerId, setPartnerId] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [invites, setInvites] = useState<StaffInviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadAll(pid: string) {
    setLoading(true);
    try {
      const [staffRes, inviteRes, dashboardRes] = await Promise.all([
        partnerApi.staffList({}),
        partnerApi.staffInvitesList({}),
        partnerApi.dashboard(pid, {}),
      ]);
      const staffResponse = staffRes as StaffListResponse;
      const inviteResponse = inviteRes as StaffInviteListResponse;
      const dashboardResponse = dashboardRes as PartnerDashboardResponse;
      const staffItems = Array.isArray(staffResponse?.items) ? staffResponse.items : [];
      const inviteItems = Array.isArray(inviteResponse?.items) ? inviteResponse.items : [];
      setStaff(staffItems);
      setInvites(inviteItems);
      setPartnerName(String(dashboardResponse?.partner || pid));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load staff data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const role = getCookie('zabava_role');
    const pid = getCookie('zabava_partner');
    if (role !== 'partner' || !pid) {
      router.replace('/partner/login');
      return;
    }
    setPartnerId(pid);
    loadAll(pid);
  }, [router]);

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === 'pending'),
    [invites]
  );

  async function handleCreateStaff(payload: { email: string; name?: string; password: string }) {
    await partnerApi.staffCreate(payload, {});
    await loadAll(partnerId);
  }

  async function handleInvite(payload: { email: string; name?: string; expiresInMinutes?: number }) {
    await partnerApi.staffInviteCreate(payload, {});
    await loadAll(partnerId);
  }

  async function handleStatusChange(staffRow: StaffListItem, nextStatus: 'active' | 'inactive') {
    await partnerApi.staffUpdateStatus(staffRow.id, nextStatus, {});
    await loadAll(partnerId);
  }

  async function handleDelete(staffRow: StaffListItem) {
    await partnerApi.staffDelete(staffRow.id, {});
    await loadAll(partnerId);
  }

  async function handleRevoke(invite: StaffInviteItem) {
    await partnerApi.staffInviteDelete(invite.token, {});
    await loadAll(partnerId);
  }

  function handleCopyInvite(invite: StaffInviteItem) {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://zabava.vercel.app';
    const url = `${base}/staff/signup?token=${encodeURIComponent(invite.token)}${invite.email ? `&email=${encodeURIComponent(invite.email)}` : ''}`;
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => alert('Invite link copied'))
        .catch(() => alert('Could not copy link, please copy manually.'));
    } else {
      alert(url);
    }
  }

  if (!partnerId) {
    return <div className="p-6 text-slate-400">Loading…</div>;
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Staff &amp; access · {partnerName}</h1>
          <p className="text-sm text-muted-foreground">Manage direct accounts and invitations for your onsite team.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/partner/dashboard" className="rounded-lg border border-border px-3 py-1 text-sm font-medium text-foreground transition hover:bg-muted">
            Back to dashboard
          </Link>
          <button
            onClick={async () => {
              try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
              router.replace('/partner/login');
            }}
            className="rounded-lg bg-primary px-3 py-1 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Logout
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <StaffCreateForm onCreate={handleCreateStaff} />
        <StaffInviteForm onCreate={handleInvite} />
      </div>

      <StaffTable items={staff} onStatusChange={handleStatusChange} onDelete={handleDelete} loading={loading} />

      <StaffInviteTable items={pendingInvites} onCopy={handleCopyInvite} onRevoke={handleRevoke} />
    </div>
  );
}
