"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import type { FlashDealStatus } from "@/lib/data/flash-deals";
import { adminApi } from "@/lib/web/api-client";
import { RefreshButton } from "@/components/ui/refresh-button";
import type { FlashDealsTableItem } from "@/components/admin/flash-deals/flash-deals-table";
import { FlashDealsTable } from "@/components/admin/flash-deals/flash-deals-table";
import { FlashDealFormDrawer } from "@/components/admin/flash-deals/flash-deal-form-drawer";
import { FlashDealUsagePanel } from "@/components/admin/flash-deals/flash-deal-usage-panel";
import { useLocalizedRouter } from "@/i18n/use-localized-router";

interface FlashDealsManagerProps {
  deals: FlashDealsTableItem[];
}

export function FlashDealsManager({ deals }: FlashDealsManagerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(deals[0]?.id ?? null);
  const router = useLocalizedRouter();
  const [isPending, startTransition] = useTransition();

  const selectedDeal = useMemo(
    () => deals.find((deal) => deal.id === selectedId) ?? null,
    [deals, selectedId],
  );

  const refresh = () =>
    startTransition(() => {
      router.refresh();
    });

  async function handleStatusChange(id: string, status: FlashDealStatus) {
    try {
      await adminApi.flashDealSetStatus(id, status, {});
      toast.success(`Flash deal status updated to ${status}`);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  }

  async function handleDuplicate(id: string) {
    try {
      await adminApi.flashDealDuplicate(id, undefined, {});
      toast.success("Flash deal duplicated");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate flash deal");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-foreground">Flash deals</h1>
          <p className="text-sm text-muted-foreground">
            Manage time-limited offers, monitor usage, and audit QR activity for partnered attractions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RefreshButton
            onRefresh={() => refresh()}
            disabled={isPending}
            label={isPending ? "Refreshing…" : "Refresh"}
          />
          <FlashDealFormDrawer
            onCreated={() => {
              toast.success("Flash deal created");
              refresh();
            }}
          />
        </div>
      </header>

      <FlashDealsTable
        items={deals}
        loading={isPending}
        onSelect={setSelectedId}
        onStatusChange={handleStatusChange}
        onDuplicate={handleDuplicate}
      />

      <FlashDealUsagePanel deal={selectedDeal} />
    </div>
  );
}
