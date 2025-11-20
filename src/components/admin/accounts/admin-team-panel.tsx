"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshButton } from "@/components/ui/refresh-button";
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
  variants: Partial<Record<string, string>>,
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
    [fetchOverview],
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
              : invite,
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
    [fetchOverview, inviteEmail, inviteLoading, inviteName],
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
    [handleRefresh],
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
    [data.adminInvites],
  );

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
        <Card className="bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Admin accounts</CardDescription>
            <CardTitle className="text-3xl">{totals.admins}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Active administrators with full control.
          </CardContent>
        </Card>
        <Card className="bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Partners</CardDescription>
            <CardTitle className="text-3xl">{totals.partners}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Organisations with partner access.
          </CardContent>
        </Card>
        <Card className="bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Partner users</CardDescription>
            <CardTitle className="text-3xl">{totals.partnerUsers}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Individual partner logins across all partners.
          </CardContent>
        </Card>
        <Card className="bg-card/70">
          <CardHeader className="pb-2">
            <CardDescription>Open invites</CardDescription>
            <CardTitle className="text-3xl">{totals.openInvites}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Pending invites awaiting acceptance.
          </CardContent>
        </Card>
      </div>

      <Accordion type="multiple" defaultValue={["admins", "partners"]} className="rounded-2xl border border-border bg-card shadow-sm">
        <AccordionItem value="admins">
          <AccordionTrigger className="px-6">
            <div className="flex w-full items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Administrators
                </p>
                <p className="text-xs text-muted-foreground">
                  Manage admin access and invitations.
                </p>
              </div>
              <Badge variant="outline">{data.admins.length}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)]">
              <Card className="border-border/80 bg-muted/40">
                <CardHeader>
                  <CardTitle className="text-base">Invite administrator</CardTitle>
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
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="admin@example.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Name (optional)
                      </label>
                      <Input
                        value={inviteName}
                        onChange={(event) => setInviteName(event.target.value)}
                        placeholder="Admin name"
                      />
                    </div>
                    <Button type="submit" disabled={inviteLoading} className="w-full">
                      {inviteLoading ? "Sending…" : "Send invite"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Pending invites expire automatically after 7 days.
                    </p>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-background">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">Admin invites</CardTitle>
                    <CardDescription>
                      {adminPendingInvites.length} pending · {data.adminInvites.length} total
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-hidden rounded-xl border border-border">
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
                            <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
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
                                    accepted: "bg-emerald-100 text-emerald-700",
                                  })}
                                >
                                  {invite.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDate(invite.expiresAt)}</TableCell>
                              <TableCell className="space-y-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleCopyLink(invite.inviteUrl)}
                                  disabled={!invite.inviteUrl}
                                >
                                  Copy link
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="w-full text-destructive hover:bg-destructive/10"
                                  onClick={() => void handleCancelInvite(invite.id)}
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
                  <div className="overflow-hidden rounded-xl border border-border">
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
                            <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
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
                              <TableCell>{formatDateTime(admin.createdAt)}</TableCell>
                              <TableCell>{formatDateTime(admin.lastLoginAt)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="partners">
          <AccordionTrigger className="px-6">
            <div className="flex w-full flex-col gap-1 text-left">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-foreground">
                  Partners & roles
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {totals.partnerUsers} partner users
                  </Badge>
                  <Badge variant="outline">{totals.staff} staff</Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Expand a partner to view their accounts, invites, and staff.
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-2 pb-6 sm:px-6">
            {data.partners.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
                No partners found.
              </div>
            ) : (
              <Accordion
                type="multiple"
                className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm"
                defaultValue={data.partners.slice(0, 3).map((partner) => partner.partnerId)}
              >
                {data.partners.map((partner) => (
                  <AccordionItem key={partner.partnerId} value={partner.partnerId}>
                    <AccordionTrigger className="px-5">
                      <div className="flex w-full flex-col gap-1 text-left">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {partner.name ?? partner.partnerId}
                            </span>
                            <Badge
                              variant="outline"
                              className={statusBadgeTone(partner.status, {
                                active: "bg-emerald-100 text-emerald-700",
                                pending: "bg-amber-100 text-amber-700",
                                hidden: "bg-slate-200 text-slate-600",
                              })}
                            >
                              {partner.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{partner.users.length} partner users</span>
                            <span>·</span>
                            <span>{partner.staff.length} staff</span>
                            <span>·</span>
                            <span>
                              {partner.invites.length + partner.staffInvites.length} invites
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {partner.partnerId}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-6">
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
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
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
    <Card className="border-border/80 bg-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
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
