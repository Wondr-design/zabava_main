"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Archive,
  Sparkles,
  TrendingUp,
  Package,
  Users,
} from "lucide-react";

import {
  PageHeader,
  DesignButton,
  FilterChip,
  SectionCard,
  StatusPill,
  DesignTable,
  DesignTableWrapper,
  DesignTableHead,
  DesignTableBody,
  DesignTableRow,
  DesignTableHeader,
  DesignTableCell,
  DesignInput,
} from "@/components/design-system";
import { RefreshButton } from "@/components/ui/refresh-button";
import type { RewardRecord } from "@/lib/data/rewards";
import { adminApi } from "@/lib/web/api-client";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useGlobalValues } from "@/hooks/use-global-values";
import { TableSkeleton } from "@/components/ui/skeletons";

export default function AdminRewardsPage() {
  const { values: categoryValues } = useGlobalValues("category", {
    includeInactive: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rewards, setRewards] = useState<RewardRecord[]>([]);
  const [partnerNameMap, setPartnerNameMap] = useState<Record<string, string>>(
    {}
  );

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const categoryOptions = useMemo(
    () =>
      categoryValues
        .filter((value) => value.isActive)
        .map((value) => ({
          value: value.key,
          label: value.label,
        })),
    [categoryValues],
  );

  async function refresh() {
    try {
      setLoading(true);
      const res = await adminApi.rewardsList({});
      setRewards(res.rewards ?? []);
      setError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load rewards";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApi.partnersList({ status: "active" });
        if (cancelled) return;
        const map: Record<string, string> = {};
        (res.items ?? []).forEach((item) => {
          const record = item as { partnerId?: string; displayName?: string | null };
          if (record.partnerId) {
            map[record.partnerId] =
              record.displayName?.trim().length
                ? record.displayName
                : record.partnerId;
          }
        });
        setPartnerNameMap(map);
      } catch {
        if (!cancelled) setPartnerNameMap({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      categoryFilter !== "all" &&
      !categoryOptions.some((option) => option.value === categoryFilter)
    ) {
      setCategoryFilter("all");
    }
  }, [categoryFilter, categoryOptions]);

  const filteredRewards = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rewards.filter((reward) => {
      const matchesQuery = needle
        ? `${reward.name} ${reward.id}`.toLowerCase().includes(needle)
        : true;
      const matchesStatus =
        statusFilter === "all" ? true : reward.status === statusFilter;
      const matchesCategory =
        categoryFilter === "all" ? true : reward.category === categoryFilter;
      return matchesQuery && matchesStatus && matchesCategory;
    });
  }, [rewards, query, statusFilter, categoryFilter]);

  const statistics = useMemo(() => {
    const active = rewards.filter((r) => r.status === "active").length;
    const totalPoints = rewards.reduce((sum, r) => sum + r.pointsCost, 0);
    const totalStock = rewards.reduce(
      (sum, r) => sum + (r.stock ?? 0),
      0,
    );
    return { active, total: rewards.length, totalPoints, totalStock };
  }, [rewards]);

  async function handleArchive(id: string, name: string) {
    if (
      !confirm(
        `Are you sure you want to archive "${name}"? This action can be undone by editing the reward.`,
      )
    ) {
      return;
    }
    try {
      await adminApi.rewardDelete(id, {});
      toast.success("Reward archived successfully");
      void refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to archive reward";
      toast.error(message);
    }
  }

  const hasActiveFilters =
    query.trim() !== "" || statusFilter !== "all" || categoryFilter !== "all";

  if (error) {
    return (
      <div className="space-y-6 px-6 py-8">
        <PageHeader
          title="Rewards"
          description="Manage the rewards shown on the bonus portal and partner experiences."
        />
        <SectionCard>
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-destructive">
              {error}
            </p>
            <DesignButton
              variant="secondary"
              size="md"
              onClick={() => void refresh()}
              className="mt-4"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </DesignButton>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-6 py-8">
      <PageHeader
        title="Rewards"
        description="Manage the rewards shown on the bonus portal and partner experiences."
        actions={
          <>
            <RefreshButton onRefresh={refresh} label="Refresh" />
            <LocalizedLink href="/admin/rewards/new">
              <DesignButton variant="primary" size="md">
                <Plus className="mr-2 h-4 w-4" />
                New reward
              </DesignButton>
            </LocalizedLink>
          </>
        }
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SectionCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total rewards
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {statistics.total}
              </p>
            </div>
            <div className="rounded-full bg-primary/10 p-3">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
          </div>
        </SectionCard>
        <SectionCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Active rewards
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {statistics.active}
              </p>
            </div>
            <div className="rounded-full bg-emerald-500/10 p-3">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        </SectionCard>
        <SectionCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total points value
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {statistics.totalPoints.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-amber-500/10 p-3">
              <Package className="h-5 w-5 text-amber-500" />
            </div>
          </div>
        </SectionCard>
        <SectionCard className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Total stock
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {statistics.totalStock.toLocaleString()}
              </p>
            </div>
            <div className="rounded-full bg-sky-500/10 p-3">
              <Users className="h-5 w-5 text-sky-500" />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Filters and Search */}
      <SectionCard
        title="Filters"
        description={`Showing ${filteredRewards.length} of ${rewards.length} rewards`}
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <DesignInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rewards by name or ID..."
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Status:
            </span>
            <FilterChip
              selected={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              All
            </FilterChip>
            <FilterChip
              selected={statusFilter === "active"}
              onClick={() => setStatusFilter("active")}
            >
              Active
            </FilterChip>
            <FilterChip
              selected={statusFilter === "inactive"}
              onClick={() => setStatusFilter("inactive")}
            >
              Inactive
            </FilterChip>

            <span className="ml-4 text-sm font-medium text-muted-foreground">
              Category:
            </span>
            <FilterChip
              selected={categoryFilter === "all"}
              onClick={() => setCategoryFilter("all")}
            >
              All categories
            </FilterChip>
            {categoryOptions.map((option) => (
              <FilterChip
                key={option.value}
                selected={categoryFilter === option.value}
                onClick={() => setCategoryFilter(option.value)}
              >
                {option.label}
              </FilterChip>
            ))}

            {hasActiveFilters && (
              <DesignButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setCategoryFilter("all");
                }}
                className="ml-auto"
              >
                <Filter className="mr-2 h-4 w-4" />
                Clear filters
              </DesignButton>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Rewards Table */}
      <SectionCard>
        {loading ? (
          <div className="overflow-hidden">
            <DesignTableWrapper>
              <DesignTable>
                <DesignTableHead>
                  <DesignTableRow>
                    <DesignTableHeader>Name</DesignTableHeader>
                    <DesignTableHeader>Points</DesignTableHeader>
                    <DesignTableHeader>Category</DesignTableHeader>
                    <DesignTableHeader>Stock</DesignTableHeader>
                    <DesignTableHeader>Visibility</DesignTableHeader>
                    <DesignTableHeader>Status</DesignTableHeader>
                    <DesignTableHeader className="text-right">
                      Actions
                    </DesignTableHeader>
                  </DesignTableRow>
                </DesignTableHead>
                <DesignTableBody>
                  <TableSkeleton rows={5} columns={6} />
                </DesignTableBody>
              </DesignTable>
            </DesignTableWrapper>
          </div>
        ) : filteredRewards.length === 0 ? (
          <div className="py-16 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              No rewards found
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Try adjusting your filters or search query."
                : "Get started by creating your first reward."}
            </p>
            {!hasActiveFilters && (
              <LocalizedLink href="/admin/rewards/new" className="mt-4 inline-block">
                <DesignButton variant="primary" size="md">
                  <Plus className="mr-2 h-4 w-4" />
                  Create reward
                </DesignButton>
              </LocalizedLink>
            )}
          </div>
        ) : (
          <div className="overflow-hidden">
            <DesignTableWrapper>
              <DesignTable>
                <DesignTableHead>
                  <DesignTableRow>
                    <DesignTableHeader>Name</DesignTableHeader>
                    <DesignTableHeader>Points</DesignTableHeader>
                    <DesignTableHeader>Category</DesignTableHeader>
                    <DesignTableHeader>Stock</DesignTableHeader>
                    <DesignTableHeader>Visibility</DesignTableHeader>
                    <DesignTableHeader>Status</DesignTableHeader>
                    <DesignTableHeader className="text-right">
                      Actions
                    </DesignTableHeader>
                  </DesignTableRow>
                </DesignTableHead>
                <DesignTableBody>
                  {filteredRewards.map((reward) => {
                    const stockAmount =
                      typeof reward.stock === "number" && reward.stock !== null
                        ? reward.stock
                        : 0;
                    const hasStockLimit = stockAmount > 0;
                    const stockLabel = hasStockLimit
                      ? reward.stockWindowDays &&
                        reward.stockWindowDays > 0
                        ? `${stockAmount.toLocaleString()} / ${
                            reward.stockWindowDays === 1
                              ? "day"
                              : `${reward.stockWindowDays} days`
                          }`
                        : `${stockAmount.toLocaleString()} total`
                      : "Unlimited";
                    const partnerLabels = reward.availableFor.map(
                      (id) => partnerNameMap[id] ?? id
                    );
                    let visibilityLabel: string;
                    if (partnerLabels.length === 0) {
                      visibilityLabel = "All partners";
                    } else if (partnerLabels.length <= 2) {
                      visibilityLabel = partnerLabels.join(", ");
                    } else {
                      visibilityLabel = `${partnerLabels
                        .slice(0, 2)
                        .join(", ")} +${partnerLabels.length - 2}`;
                    }
                    const categoryLabel =
                      categoryOptions.find(
                        (option) => option.value === reward.category,
                      )?.label ?? reward.category;
                    return (
                      <DesignTableRow
                        key={reward.id}
                        clickable
                        className="group"
                      >
                        <DesignTableCell>
                          <div>
                            <div className="font-medium text-foreground">
                              {reward.name}
                            </div>
                            {reward.description && (
                              <div className="mt-1 text-xs text-muted-foreground line-clamp-1">
                                {reward.description}
                              </div>
                            )}
                          </div>
                        </DesignTableCell>
                        <DesignTableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">
                              {reward.pointsCost.toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              pts
                            </span>
                          </div>
                        </DesignTableCell>
                        <DesignTableCell>
                          <span className="text-sm text-muted-foreground">
                            {categoryLabel}
                          </span>
                        </DesignTableCell>
                        <DesignTableCell>
                          <span className="text-sm text-muted-foreground">
                            {stockLabel}
                          </span>
                        </DesignTableCell>
                        <DesignTableCell>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {visibilityLabel}
                            </span>
                          </div>
                        </DesignTableCell>
                        <DesignTableCell>
                          <StatusPill
                            tone={
                              reward.status === "active"
                                ? "success"
                                : "neutral"
                            }
                          >
                            {reward.status}
                          </StatusPill>
                        </DesignTableCell>
                        <DesignTableCell>
                          <div className="flex items-center justify-end gap-2">
                            <LocalizedLink
                              href={`/admin/rewards/${reward.id}`}
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <DesignButton
                                variant="ghost"
                                size="icon"
                                aria-label="Edit reward"
                              >
                                <Edit2 className="h-4 w-4" />
                              </DesignButton>
                            </LocalizedLink>
                            <DesignButton
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleArchive(reward.id, reward.name)
                              }
                              className="opacity-0 transition-opacity group-hover:opacity-100 text-destructive hover:bg-destructive/10"
                              aria-label="Archive reward"
                            >
                              <Archive className="h-4 w-4" />
                            </DesignButton>
                          </div>
                        </DesignTableCell>
                      </DesignTableRow>
                    );
                  })}
                </DesignTableBody>
              </DesignTable>
            </DesignTableWrapper>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
