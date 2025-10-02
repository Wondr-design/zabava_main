"use client";

import { useMemo } from "react";

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

  function update<K extends keyof PartnerFilterState>(key: K, val: PartnerFilterState[K]) {
    onChange({ ...value, [key]: val });
  }

  const prettyRange = useMemo(() => {
    if (!value.from && !value.to) return "All time";
    const f = value.from ? new Date(value.from).toLocaleDateString() : "";
    const t = value.to ? new Date(value.to).toLocaleDateString() : "";
    if (f && t) return `${f} → ${t}`;
    if (f) return `From ${f}`;
    return `Until ${t}`;
  }, [value.from, value.to]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-end md:justify-between">
      <div className="flex flex-1 flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Search</label>
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
          placeholder="Search emails, ticket type..."
          value={value.search}
          onChange={(e) => update("search", e.target.value)}
        />
      </div>
      <div className="flex gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
          <select
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
            value={value.status}
            onChange={(e) => update("status", e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="visited">Visited</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">From</label>
          <input
            type="date"
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
            value={value.from || ""}
            onChange={(e) => update("from", e.target.value || undefined)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">To</label>
          <input
            type="date"
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
            value={value.to || ""}
            onChange={(e) => update("to", e.target.value || undefined)}
          />
        </div>
      </div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{prettyRange}</div>
    </div>
  );
}
