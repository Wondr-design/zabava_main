import { loadAdminAccountOverview } from "@/lib/data/admin-account-overview";
import { AdminTeamPanel } from "@/components/admin/accounts/admin-team-panel";

export const metadata = {
  title: "Admin accounts · Zabava",
};

export default async function AdminAccountsPage() {
  const overview = await loadAdminAccountOverview();

  return (
    <div className="space-y-6 px-6 py-8">
      <AdminTeamPanel initialData={overview} />
    </div>
  );
}
