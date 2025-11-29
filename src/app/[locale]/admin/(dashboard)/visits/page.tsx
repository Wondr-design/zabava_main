import { VisitDetailPanelWrapper } from "@/components/visits/visit-detail-panel-wrapper";
import { RefreshButton } from "@/components/ui/refresh-button";
import { fetchVisits } from "@/lib/data/analytics";

type SearchParams = Record<string, string | string[] | undefined>;

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminVisitsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const partnerId =
    typeof params.partnerId === "string" ? params.partnerId : "";
  const status = typeof params.status === "string" ? params.status : "";

  const normalizedStatus = ["pending", "visited", "cancelled"].includes(status)
    ? (status as "pending" | "visited" | "cancelled")
    : undefined;

  const visits = await fetchVisits({
    email,
    partnerId,
    status: normalizedStatus,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-foreground">Visits</h1>
          <p className="text-sm text-muted-foreground">
            Filter and review recent visit registrations.
          </p>
        </div>
        <RefreshButton />
      </div>
      <VisitDetailPanelWrapper
        initialVisits={visits}
        initialFilters={{ email, partnerId, status }}
      />
    </div>
  );
}
