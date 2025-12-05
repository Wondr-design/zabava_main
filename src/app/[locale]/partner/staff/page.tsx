"use client";

import { useEffect, useMemo, useState } from "react";
import { partnerApi } from "@/lib/web/api-client";
import { StaffTable, StaffListItem } from "@/components/partner/staff-table";
import { StaffInviteForm } from "@/components/partner/staff-invite-form";
import {
  StaffInviteTable,
  StaffInviteItem,
} from "@/components/partner/staff-invite-table";
import { StaffCreateForm } from "@/components/partner/staff-create-form";
import { LogOut } from "lucide-react";
import { useLocale } from "@/i18n/provider";
import { buildLocalizedPath } from "@/i18n/routing";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
import { LocalizedLink } from "@/components/ui/localized-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PageHeaderSkeleton,
  CardSkeleton,
  TableSkeleton,
  Skeleton,
} from "@/components/ui/skeletons";

type StaffListResponse = { items?: StaffListItem[] };
type StaffInviteListResponse = { items?: StaffInviteItem[] };
type PartnerDashboardResponse = { partner?: string };

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [k, v] = cookie.trim().split("=");
    if (k === name && v !== undefined) return decodeURIComponent(v);
  }
  return "";
}

export default function PartnerStaffPage() {
  const router = useLocalizedRouter();
  const locale = useLocale();
  const [partnerId, setPartnerId] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [staff, setStaff] = useState<StaffListItem[]>([]);
  const [invites, setInvites] = useState<StaffInviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      const staffItems = Array.isArray(staffResponse?.items)
        ? staffResponse.items
        : [];
      const inviteItems = Array.isArray(inviteResponse?.items)
        ? inviteResponse.items
        : [];
      setStaff(staffItems);
      setInvites(inviteItems);
      setPartnerName(String(dashboardResponse?.partner || pid));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load staff data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const role = getCookie("zabava_role");
    const pid = getCookie("zabava_partner");
    if (role !== "partner" || !pid) {
      router.replace("/partner/login");
      return;
    }
    setPartnerId(pid);
    loadAll(pid);
  }, [router]);

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === "pending"),
    [invites]
  );

  async function handleCreateStaff(payload: {
    email: string;
    name?: string;
    password: string;
  }) {
    await partnerApi.staffCreate(payload, {});
    await loadAll(partnerId);
  }

  async function handleInvite(payload: {
    email: string;
    name?: string;
    expiresInMinutes?: number;
  }) {
    await partnerApi.staffInviteCreate(payload, {});
    await loadAll(partnerId);
  }

  async function handleStatusChange(
    staffRow: StaffListItem,
    nextStatus: "active" | "inactive"
  ) {
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
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://zabava.vercel.app";
    const signupUrl = new URL(
      buildLocalizedPath("/staff/signup", locale, {
        targetLocale: locale,
      }),
      base,
    );
    signupUrl.searchParams.set("token", invite.token);
    if (invite.email) {
      signupUrl.searchParams.set("email", invite.email);
    }
    const url = signupUrl.toString();
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => alert("Invite link copied"))
        .catch(() => alert("Could not copy link, please copy manually."));
    } else {
      alert(url);
    }
  }

  if (!partnerId) {
    return (
      <div className="space-y-8 p-6">
        <PageHeaderSkeleton showActions />
        <div className="grid gap-6 lg:grid-cols-2">
          <CardSkeleton showHeader rows={4} />
          <CardSkeleton showHeader rows={4} />
        </div>
        <CardSkeleton showHeader rows={5} />
        <CardSkeleton showHeader rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            Staff &amp; access · {partnerName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage direct accounts and invitations for your onsite team.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="secondary" size="sm">
            <LocalizedLink href="/partner/dashboard">Back to dashboard</LocalizedLink>
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={async () => {
              try {
                await fetch("/api/auth/logout", { method: "POST" });
              } catch {}
              router.replace("/partner/login");
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Logout
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-lg p-6">
          <StaffCreateForm onCreate={handleCreateStaff} />
        </Card>
        <Card className="rounded-lg p-6">
          <StaffInviteForm onCreate={handleInvite} />
        </Card>
      </div>

      <Card className="rounded-lg p-6">
        {loading && staff.length === 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32 rounded" />
              <Skeleton className="h-4 w-64 rounded" />
            </div>
            <TableSkeleton rows={5} columns={4} showHeader />
          </div>
        ) : (
          <StaffTable
            items={staff}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            loading={loading}
          />
        )}
      </Card>

      <Card className="rounded-lg p-6">
        <StaffInviteTable
          items={pendingInvites}
          onCopy={handleCopyInvite}
          onRevoke={handleRevoke}
        />
      </Card>
    </div>
  );
}
