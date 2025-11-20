import { adminApi } from "@/lib/web/api-client";
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
  const { items } = await adminApi.billingList({ token: undefined });
  return <AdminBillingsClient initialItems={items} locale={locale} />;
}
