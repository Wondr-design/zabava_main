import { AdminBillingsClient } from "@/components/admin/billings/admin-billings-client";

export const metadata = {
  title: "Billings · Admin",
};

export default async function BillingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  // Client will fetch via adminApi (client-side); render with empty initial state
  return <AdminBillingsClient initialItems={[]} />;
}
