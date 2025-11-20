import { GlobalsDashboard } from "@/components/admin/globals/globals-dashboard";
import {
  listGlobalValueGroups,
  type GlobalValueRecord,
  type GlobalValueType,
} from "@/lib/data/global-values";

export const metadata = {
  title: "Global references · Zabava",
};

export default async function AdminGlobalsPage() {
  const groups = await listGlobalValueGroups({ includeInactive: true });

  const initialValues: Record<
    GlobalValueType,
    GlobalValueRecord[]
  > = {
    ticket_type: groups.ticketTypes,
    category: groups.categories,
    tag: groups.tags,
    listing_tier: groups.listingTiers,
    cash_currency: groups.cashCurrencies,
    accepted_payment: groups.acceptedPayments,
    facility: groups.facilities,
  };

  return <GlobalsDashboard initialValues={initialValues} />;
}
