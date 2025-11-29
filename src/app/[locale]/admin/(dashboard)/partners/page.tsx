import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { PartnersDashboard } from "@/components/admin/partners/partners-dashboard";
import { PartnerInviteFormState } from "@/components/partners/partner-invite-form";
import { RefreshButton } from "@/components/ui/refresh-button";
import { fetchPartnersOverview } from "@/lib/data/analytics";
import {
  createPartnerInvite,
  deletePartnerInvite,
  listPartnerInvites,
} from "@/lib/data/invites";
import { getPartnerShowcaseDirectory } from "@/lib/data/partner-showcase";
import { resolveLocale } from "@/i18n/config";
import { buildLocalizedPath } from "@/i18n/routing";

export default async function AdminPartnersPage() {
  const headerStore = await headers();
  const locale = resolveLocale(headerStore.get("x-locale"));

  const [overviewPartners, invites, directory] = await Promise.all([
    fetchPartnersOverview(),
    listPartnerInvites({ limit: 25 }),
    getPartnerShowcaseDirectory(),
  ]);

  async function createInviteAction(
    _prevState: PartnerInviteFormState,
    formData: FormData,
  ) {
    "use server";
    try {
      const email = String(formData.get("email") ?? "").trim();
      const partnerId = String(formData.get("partnerId") ?? "").trim();
      const role = String(formData.get("role") ?? "partner");
      const name = String(formData.get("name") ?? "").trim() || undefined;
      const expiresInMinutes = Number(
        formData.get("expiresInMinutes") ?? 60 * 24,
      );

      const invite = await createPartnerInvite({
        email,
        partnerId,
        role: role === "admin" ? "admin" : "partner",
        name,
        expiresInMinutes,
        locale,
      });

      const { notifyPartnerInvite } = await import(
        "@/lib/services/invites/notify"
      );
      await notifyPartnerInvite(invite);

      revalidatePath(buildLocalizedPath("/admin/partners", locale));
      revalidatePath(buildLocalizedPath("/admin/invites", locale));
      return { success: true };
    } catch (error) {
      console.error("create invite action error", error);
      return { error: "Failed to create invite" };
    }
  }

  async function deleteInviteAction(formData: FormData) {
    "use server";
    const token = String(formData.get("token") ?? "");
    if (!token) return;
    try {
      await deletePartnerInvite(token);
      revalidatePath(buildLocalizedPath("/admin/partners", locale));
      revalidatePath(buildLocalizedPath("/admin/invites", locale));
    } catch (error) {
      console.error("delete invite error", error);
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-foreground">Partners</h1>
          <p className="text-sm text-muted-foreground">
            Manage partners, assign categories, and review invites.
          </p>
        </div>
        <RefreshButton />
      </header>

      <PartnersDashboard
        overviewPartners={overviewPartners}
        directory={directory}
        invites={invites.items ?? []}
        createInviteAction={createInviteAction}
        deleteInviteAction={deleteInviteAction}
      />
    </div>
  );
}
