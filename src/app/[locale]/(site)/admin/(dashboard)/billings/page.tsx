import { resolveLocale } from "@/i18n/config";
import { AdminBillingsClient } from "@/components/admin/billings/admin-billings-client";

export const metadata = {
  title: "Billings · Admin",
};

export default async function BillingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = resolveLocale(rawLocale);
  // Client will fetch via adminApi (client-side); render with empty initial state
  return <AdminBillingsClient initialItems={[]} locale={locale} />;
}
