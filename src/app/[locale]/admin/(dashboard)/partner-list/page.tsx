import { PartnerListPanel } from "@/components/admin/partner-list/partner-list-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminPartnerListPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-foreground">Partner list</h1>
        <p className="text-sm text-muted-foreground">
          Generate the snippet that powers the category partner list page on
          Tilda.
        </p>
      </header>

      <PartnerListPanel />
    </div>
  );
}
