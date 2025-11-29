import { CategoriesDashboard } from "@/components/admin/categories/categories-dashboard";
import { getPartnerShowcaseDirectory } from "@/lib/data/partner-showcase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCategoriesPage() {
  const directory = await getPartnerShowcaseDirectory();

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-foreground">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Manage visitor segments and generate embed snippets for your Tilda
          pages.
        </p>
      </header>

      <CategoriesDashboard directory={directory} />
    </div>
  );
}
