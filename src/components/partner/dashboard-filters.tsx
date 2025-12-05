"use client";

import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export type PartnerFilterState = {
  search: string;
  status: "all" | "visited" | "pending" | "cancelled";
  from?: string;
  to?: string;
};

export function DashboardFilters(props: {
  value: PartnerFilterState;
  onChange: (next: PartnerFilterState) => void;
}) {
  const { value, onChange } = props;

  function update<K extends keyof PartnerFilterState>(
    key: K,
    val: PartnerFilterState[K],
  ) {
    onChange({ ...value, [key]: val });
  }

  const prettyRange = useMemo(() => {
    if (!value.from && !value.to) return "All time";
    const from = value.from ? new Date(value.from).toLocaleDateString() : "";
    const to = value.to ? new Date(value.to).toLocaleDateString() : "";
    if (from && to) return `${from} → ${to}`;
    if (from) return `From ${from}`;
    return `Until ${to}`;
  }, [value.from, value.to]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2 lg:max-w-xs">
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          value={value.search}
          onChange={(event) => update("search", event.target.value)}
          placeholder="Search emails, ticket type…"
        />
        <p className="text-xs text-muted-foreground">
          Filter by email, ticket type, or notes.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={value.status}
            onValueChange={(next) =>
              update("status", next as PartnerFilterState["status"])
            }
          >
            <SelectTrigger id="status" className="w-[140px]" aria-label="Filter by visit status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="visited">Visited</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            type="date"
            value={value.from ?? ""}
            onChange={(event) => update("from", event.target.value || undefined)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <Input
            id="to"
            type="date"
            value={value.to ?? ""}
            onChange={(event) => update("to", event.target.value || undefined)}
          />
        </div>
      </div>

      <Badge variant="secondary" className="self-start">
        {prettyRange}
      </Badge>
    </div>
  );
}
