import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  createPartnerInvite,
  deletePartnerInvite,
  listPartnerInvites,
} from "@/lib/data/invites";
import { getPartnerShowcaseDirectory } from "@/lib/data/partner-showcase";
import {
  PartnerInviteForm,
  PartnerInviteFormState,
} from "@/components/partners/partner-invite-form";
import { PartnerInviteTable } from "@/components/partners/partner-invite-table";
import { RefreshButton } from "@/components/ui/refresh-button";
import { resolveLocale } from "@/i18n/config";
import { buildLocalizedPath } from "@/i18n/routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminInvitesPage() {
  const headerStore = await headers();
  const locale = resolveLocale(headerStore.get("x-locale"));

  const [invites, directory] = await Promise.all([
    listPartnerInvites({ limit: 50 }),
    getPartnerShowcaseDirectory(),
  ]);

  async function createInviteAction(
    _prev: PartnerInviteFormState,
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

      revalidatePath(buildLocalizedPath("/admin/invites", locale));
      revalidatePath(buildLocalizedPath("/admin/partners", locale));
      return { success: true };
    } catch (error) {
      console.error("admin invites create error", error);
      return { error: "Failed to create invite" };
    }
  }

  async function deleteInviteAction(formData: FormData) {
    "use server";
    const token = String(formData.get("token") ?? "");
    if (!token) return;
    try {
      await deletePartnerInvite(token);
      revalidatePath(buildLocalizedPath("/admin/invites", locale));
      revalidatePath(buildLocalizedPath("/admin/partners", locale));
    } catch (error) {
      console.error("admin invites delete error", error);
      throw error;
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-foreground">Invites</h1>
          <p className="text-sm text-muted-foreground">
            Generate partner or admin access links and monitor usage status.
          </p>
        </div>
        <RefreshButton />
      </header>

      <PartnerInviteForm
        action={createInviteAction}
        partners={directory.partners.map((partner) => ({
          id: partner.partnerId,
          name: partner.name,
        }))}
      />

      <PartnerInviteTable
        invites={invites.items ?? []}
        deleteAction={deleteInviteAction}
      />
    </div>
  );
}
