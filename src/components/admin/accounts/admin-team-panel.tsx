"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshButton } from "@/components/ui/refresh-button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getCsrfToken } from "@/lib/web/csrf";
import { adminApi } from "@/lib/web/api-client";
import type {
  AdminAccountOverview,
  PartnerInviteSummary,
  PartnerStaffInviteSummary,
  PartnerStaffSummary,
  PartnerUserSummary,
} from "@/lib/data/admin-account-overview";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function statusBadgeTone(
  status: string,
  variants: Partial<Record<string, string>>
) {
  return (
    variants[status] ??
    "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
  );
}

interface AdminTeamPanelProps {
  initialData: AdminAccountOverview;
}

export function AdminTeamPanel({ initialData }: AdminTeamPanelProps) {
  const [data, setData] = useState<AdminAccountOverview>(initialData);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(
    new Set(initialData.partners.slice(0, 3).map((p) => p.partnerId))
  );

  // Update expanded partners when data changes (preserve existing expansions)
  useEffect(() => {
    setExpandedPartners((prev) => {
      const next = new Set(prev);
      // Remove partners that no longer exist
      const existingPartnerIds = new Set(data.partners.map((p) => p.partnerId));
      Array.from(next).forEach((id) => {
        if (!existingPartnerIds.has(id)) {
          next.delete(id);
        }
      });
      return next;
    });
  }, [data.partners]);

  const totals = data.totals;

  const fetchOverview = useCallback(async () => {
    const response = await adminApi.accountsOverview({});
    return response.overview;
  }, []);

  const handleRefresh = useCallback(
    async (options: { showToast?: boolean } = {}) => {
      setLoading(true);
      try {
        const overview = await fetchOverview();
        setData(overview);
        if (options.showToast !== false) {
          toast.success("Team overview updated.");
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to refresh team overview.";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [fetchOverview]
  );

  const handleCreateInvite = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (inviteLoading) return;
      setInviteLoading(true);
      try {
        const response = await fetch("/api/admin/accounts/invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": getCsrfToken(),
          },
          credentials: "include",
          body: JSON.stringify({
            email: inviteEmail.trim().toLowerCase(),
            name: inviteName.trim() || undefined,
          }),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error || "Failed to create admin invite");
        }
        const overview = await fetchOverview();
        if (body?.invite?.id && body?.inviteUrl) {
          overview.adminInvites = overview.adminInvites.map((invite) =>
            invite.id === body.invite.id
              ? { ...invite, inviteUrl: body.inviteUrl as string | null }
              : invite
          );
        }
        setData(overview);
        setInviteEmail("");
        setInviteName("");
        toast.success("Admin invite created.");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create invite.";
        toast.error(message);
      } finally {
        setInviteLoading(false);
      }
    },
    [fetchOverview, inviteEmail, inviteLoading, inviteName]
  );

  const handleCancelInvite = useCallback(
    async (inviteId: string) => {
      try {
        const response = await fetch(`/api/admin/accounts/invite/${inviteId}`, {
          method: "DELETE",
          headers: {
            "x-csrf-token": getCsrfToken(),
          },
          credentials: "include",
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to cancel invite");
        }
        await handleRefresh({ showToast: false });
        toast.success("Admin invite cancelled.");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to cancel invite.";
        toast.error(message);
      }
    },
    [handleRefresh]
  );

  const handleCopyLink = useCallback(async (url: string | null | undefined) => {
    if (!url) {
      toast.error("Invite link not available.");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied to clipboard.");
    } catch {
      toast.error("Unable to copy invite link.");
    }
  }, []);

  const adminPendingInvites = useMemo(
    () => data.adminInvites.filter((invite) => invite.status === "pending"),
    [data.adminInvites]
  );

  const togglePartner = useCallback((partnerId: string) => {
    setExpandedPartners((prev) => {
      const next = new Set(prev);
      if (next.has(partnerId)) {
        next.delete(partnerId);
      } else {
        next.add(partnerId);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Team directory
          </h1>
          <p className="text-sm text-muted-foreground">
            View and manage admin, partner, and staff access in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton
            onRefresh={() => handleRefresh()}
            disabled={loading}
            label="Refresh"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Admin accounts</CardDescription>
            <CardTitle className="text-3xl">{totals.admins}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Active administrators with full control.
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Partners</CardDescription>
            <CardTitle className="text-3xl">{totals.partners}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Organisations with partner access.
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Partner users</CardDescription>
            <CardTitle className="text-3xl">{totals.partnerUsers}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Individual partner logins across all partners.
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription>Open invites</CardDescription>
            <CardTitle className="text-3xl">{totals.openInvites}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Pending invites awaiting acceptance.
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Tabs defaultValue="admins" className="w-full">
          <div className="border-b border-border px-6 pt-4">
            <TabsList className="bg-transparent">
              <TabsTrigger
                value="admins"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:rounded-none"
              >
                Administrators
                <Badge variant="outline" className="ml-2">
                  {data.admins.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="partners"
                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:rounded-none"
              >
                Partners & roles
                <Badge variant="outline" className="ml-2">
                  {totals.partners}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="admins" className="p-6 mt-0">
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-6">
                  Manage admin access and invitations.
                </p>
              </div>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)]">
                <Card className="border border-border bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Invite administrator
                    </CardTitle>
                    <CardDescription>
                      Send an email invite to grant admin access.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-3" onSubmit={handleCreateInvite}>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Email
                        </label>
                        <Input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(event) =>
                            setInviteEmail(event.target.value)
                          }
                          placeholder="admin@example.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Name (optional)
                        </label>
                        <Input
                          value={inviteName}
                          onChange={(event) =>
                            setInviteName(event.target.value)
                          }
                          placeholder="Admin name"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={inviteLoading}
                        className="w-full"
                      >
                        {inviteLoading ? "Sending…" : "Send invite"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Pending invites expire automatically after 7 days.
                      </p>
                    </form>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-background">
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">Admin invites</CardTitle>
                      <CardDescription>
                        {adminPendingInvites.length} pending ·{" "}
                        {data.adminInvites.length} total
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="overflow-hidden rounded-lg border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Expires</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.adminInvites.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center text-sm text-muted-foreground"
                              >
                                No admin invites yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            data.adminInvites.map((invite) => (
                              <TableRow key={invite.id} className="align-top">
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium text-foreground">
                                      {invite.email}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Invited {formatDateTime(invite.createdAt)}
                                    </span>
                                    {invite.inviterEmail ? (
                                      <span className="text-xs text-muted-foreground">
                                        By {invite.inviterEmail}
                                      </span>
                                    ) : null}
                                  </div>
                                </TableCell>
                                <TableCell className="space-y-1">
                                  <Badge
                                    className={statusBadgeTone(invite.status, {
                                      pending: "bg-amber-100 text-amber-800",
                                      expired: "bg-rose-100 text-rose-700",
                                      accepted:
                                        "bg-emerald-100 text-emerald-700",
                                    })}
                                  >
                                    {invite.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {formatDate(invite.expiresAt)}
                                </TableCell>
                                <TableCell className="space-y-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() =>
                                      handleCopyLink(invite.inviteUrl)
                                    }
                                    disabled={!invite.inviteUrl}
                                  >
                                    Copy link
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="w-full text-destructive hover:bg-destructive/10"
                                    onClick={() =>
                                      void handleCancelInvite(invite.id)
                                    }
                                  >
                                    Cancel
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead>Last active</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.admins.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center text-sm text-muted-foreground"
                              >
                                No administrators yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            data.admins.map((admin) => (
                              <TableRow key={admin.email}>
                                <TableCell>{admin.name ?? "—"}</TableCell>
                                <TableCell className="font-medium text-foreground">
                                  {admin.email}
                                </TableCell>
                                <TableCell>
                                  {formatDateTime(admin.createdAt)}
                                </TableCell>
                                <TableCell>
                                  {formatDateTime(admin.lastLoginAt)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="partners" className="p-6 mt-0">
            <div className="space-y-6">
              <div>
                <p className="text-sm text-muted-foreground">
                  Click on a partner to view their accounts, invites, and staff
                  members.
                </p>
              </div>
              {data.partners.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                  No partners found.
                </div>
              ) : (
                <div className="space-y-4">
                  {data.partners.map((partner) => {
                    const isExpanded = expandedPartners.has(partner.partnerId);
                    return (
                      <Card
                        key={partner.partnerId}
                        className="border border-border bg-card"
                      >
                        <button
                          type="button"
                          onClick={() => togglePartner(partner.partnerId)}
                          className="w-full text-left"
                          aria-expanded={isExpanded}
                          aria-controls={`partner-${partner.partnerId}-content`}
                        >
                          <CardHeader className="hover:bg-muted/30 transition-colors">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-foreground">
                                      {partner.name ?? partner.partnerId}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={statusBadgeTone(
                                        partner.status,
                                        {
                                          active:
                                            "bg-emerald-100 text-emerald-700 border-emerald-300",
                                          pending:
                                            "bg-amber-100 text-amber-700 border-amber-300",
                                          hidden:
                                            "bg-slate-200 text-slate-600 border-slate-300",
                                        }
                                      )}
                                    >
                                      {partner.status}
                                    </Badge>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {partner.partnerId}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span>
                                  {partner.users.length} partner users
                                </span>
                                <span>·</span>
                                <span>{partner.staff.length} staff</span>
                                <span>·</span>
                                <span>
                                  {partner.invites.length +
                                    partner.staffInvites.length}{" "}
                                  invites
                                </span>
                              </div>
                            </div>
                          </CardHeader>
                        </button>
                        {isExpanded && (
                          <div
                            id={`partner-${partner.partnerId}-content`}
                            className="border-t border-border px-6 pb-6 pt-6"
                          >
                            <div className="grid gap-6 lg:grid-cols-2">
                              <PartnerSection
                                title="Partner users"
                                emptyMessage="No partner users yet."
                                isEmpty={partner.users.length === 0}
                              >
                                <PartnerUsersTable users={partner.users} />
                              </PartnerSection>
                              <PartnerSection
                                title="Partner invites"
                                emptyMessage="No partner invites."
                                isEmpty={partner.invites.length === 0}
                              >
                                <PartnerInvitesTable
                                  invites={partner.invites}
                                  onCopyLink={handleCopyLink}
                                />
                              </PartnerSection>
                              <PartnerSection
                                title="Staff members"
                                emptyMessage="No staff members yet."
                                isEmpty={partner.staff.length === 0}
                              >
                                <PartnerStaffTable staff={partner.staff} />
                              </PartnerSection>
                              <PartnerSection
                                title="Staff invites"
                                emptyMessage="No staff invites."
                                isEmpty={partner.staffInvites.length === 0}
                              >
                                <PartnerStaffInvitesTable
                                  invites={partner.staffInvites}
                                  onCopyLink={handleCopyLink}
                                />
                              </PartnerSection>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PartnerSection({
  title,
  emptyMessage,
  isEmpty,
  children,
}: {
  title: string;
  emptyMessage: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-background">
          {children}
        </div>
      )}
    </div>
  );
}

function PartnerUsersTable({ users }: { users: PartnerUserSummary[] }) {
  if (users.length === 0) {
    return (
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="text-center text-sm text-muted-foreground">
              No partner users yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Invited</TableHead>
          <TableHead>Last login</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.email}>
            <TableCell>{user.name ?? "—"}</TableCell>
            <TableCell className="font-medium text-foreground">
              {user.email}
            </TableCell>
            <TableCell>{formatDateTime(user.createdAt)}</TableCell>
            <TableCell>{formatDateTime(user.lastLoginAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PartnerInvitesTable({
  invites,
  onCopyLink,
}: {
  invites: PartnerInviteSummary[];
  onCopyLink: (url: string | null | undefined) => void;
}) {
  if (invites.length === 0) {
    return (
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="text-center text-sm text-muted-foreground">
              No partner invites.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invites.map((invite) => (
          <TableRow key={invite.token}>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">
                  {invite.email ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Created {formatDateTime(invite.createdAt)}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                className={statusBadgeTone(invite.status, {
                  pending: "bg-amber-100 text-amber-700",
                  expired: "bg-rose-100 text-rose-700",
                  used: "bg-emerald-100 text-emerald-700",
                })}
              >
                {invite.status}
              </Badge>
            </TableCell>
            <TableCell>{formatDate(invite.expiresAt)}</TableCell>
            <TableCell>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onCopyLink(invite.inviteUrl)}
                disabled={!invite.inviteUrl}
              >
                Copy link
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PartnerStaffTable({ staff }: { staff: PartnerStaffSummary[] }) {
  if (staff.length === 0) {
    return (
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="text-center text-sm text-muted-foreground">
              No staff members.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last login</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {staff.map((member) => (
          <TableRow key={member.id}>
            <TableCell>{member.name ?? "—"}</TableCell>
            <TableCell className="font-medium text-foreground">
              {member.email}
            </TableCell>
            <TableCell>
              <Badge
                className={statusBadgeTone(member.status, {
                  active: "bg-emerald-100 text-emerald-700",
                  inactive: "bg-slate-200 text-slate-600",
                  revoked: "bg-rose-100 text-rose-700",
                })}
              >
                {member.status}
              </Badge>
            </TableCell>
            <TableCell>{formatDateTime(member.lastLoginAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PartnerStaffInvitesTable({
  invites,
  onCopyLink,
}: {
  invites: PartnerStaffInviteSummary[];
  onCopyLink: (url: string | null | undefined) => void;
}) {
  if (invites.length === 0) {
    return (
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="text-center text-sm text-muted-foreground">
              No staff invites.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invites.map((invite) => (
          <TableRow key={invite.token}>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">
                  {invite.email ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Created {formatDateTime(invite.createdAt)}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                className={statusBadgeTone(invite.status, {
                  pending: "bg-amber-100 text-amber-700",
                  expired: "bg-rose-100 text-rose-700",
                  revoked: "bg-slate-200 text-slate-600",
                  used: "bg-emerald-100 text-emerald-700",
                })}
              >
                {invite.status}
              </Badge>
            </TableCell>
            <TableCell>{formatDate(invite.expiresAt)}</TableCell>
            <TableCell>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onCopyLink(null)}
                disabled
              >
                Copy link
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
