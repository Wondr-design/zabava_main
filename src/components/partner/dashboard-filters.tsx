"use client";

import { useMemo } from "react";

import {
  DesignFormField,
  DesignInput,
  DesignSelect,
  DesignSelectContent,
  DesignSelectItem,
  DesignSelectTrigger,
  DesignSelectValue,
  StatusPill,
} from "@/components/design-system";

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
      <DesignFormField
        label="Search"
        helper="Filter by email, ticket type, or notes."
        className="lg:max-w-xs"
      >
        <DesignInput
          value={value.search}
          onChange={(event) => update("search", event.target.value)}
          placeholder="Search emails, ticket type…"
        />
      </DesignFormField>

      <div className="flex flex-wrap gap-4">
        <DesignFormField label="Status">
          <DesignSelect
            value={value.status}
            onValueChange={(next) =>
              update("status", next as PartnerFilterState["status"])
            }
          >
            <DesignSelectTrigger aria-label="Filter by visit status">
              <DesignSelectValue placeholder="All statuses" />
            </DesignSelectTrigger>
            <DesignSelectContent>
              <DesignSelectItem value="all">All</DesignSelectItem>
              <DesignSelectItem value="visited">Visited</DesignSelectItem>
              <DesignSelectItem value="pending">Pending</DesignSelectItem>
              <DesignSelectItem value="cancelled">Cancelled</DesignSelectItem>
            </DesignSelectContent>
          </DesignSelect>
        </DesignFormField>

        <DesignFormField label="From">
          <DesignInput
            type="date"
            value={value.from ?? ""}
            onChange={(event) => update("from", event.target.value || undefined)}
          />
        </DesignFormField>

        <DesignFormField label="To">
          <DesignInput
            type="date"
            value={value.to ?? ""}
            onChange={(event) => update("to", event.target.value || undefined)}
          />
        </DesignFormField>
      </div>

      <StatusPill tone="neutral" size="sm" className="self-start">
        {prettyRange}
      </StatusPill>
    </div>
  );
}
