"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { adminApi } from "@/lib/web/api-client";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Button } from "@/components/ui/button";
import {
  TransportServiceTable,
  type TransportServiceRow,
} from "@/components/admin/transport/transport-service-table";
import {
  TransportRideTable,
  type TransportRideRowItem,
} from "@/components/admin/transport/transport-ride-table";
import { TransportServiceFormDrawer } from "@/components/admin/transport/transport-service-form-drawer";
import { useLocalizedRouter } from "@/i18n/use-localized-router";

export type { TransportServiceRow, TransportRideRowItem };

export interface TransportDashboardProps {
  services: TransportServiceRow[];
  rides: TransportRideRowItem[];
}

interface FilePayload {
  filename: string;
  contentType: string;
  base64: string;
}

const downloadFile = ({ filename, contentType, base64 }: FilePayload) => {
  if (typeof window === "undefined") return;

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: contentType });
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

export function TransportDashboard({ services, rides }: TransportDashboardProps) {
  const router = useLocalizedRouter();
  const [isPending, startTransition] = useTransition();
  const [isActioning, setIsActioning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const loading = isPending || isActioning;
  const busy = loading || isExporting;

  const handleRefresh = () =>
    startTransition(() => {
      router.refresh();
    });

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      setIsActioning(true);
      await adminApi.transportServiceToggle(id, enabled, {});
      toast.success(`Service ${enabled ? "enabled" : "disabled"}`);
      handleRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update service status.";
      toast.error(message);
    } finally {
      setIsActioning(false);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await adminApi.transportRidesExport({}, {});

      downloadFile(response.files.csv);
      downloadFile(response.files.xlsx);

      toast.success(
        `Ride export ready: ${response.summary.rideCount} rides (${response.summary.dateFrom} → ${response.summary.dateTo}).`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export rides.";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-foreground">Transport services</h1>
          <p className="text-sm text-muted-foreground">
            Manage taxi, bus, and limousine partners. Control commission rates, QR validity, and export ride logs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RefreshButton
            onRefresh={handleRefresh}
            disabled={busy}
            label={loading ? "Refreshing…" : "Refresh"}
          />
          <Button
            type="button"
            variant="outline"
            disabled={isExporting}
            onClick={handleExport}
          >
            {isExporting ? "Preparing export…" : "Export rides (CSV/XLSX)"}
          </Button>
          <TransportServiceFormDrawer onCreated={handleRefresh} />
        </div>
      </header>

      <TransportServiceTable
        items={services}
        loading={loading}
        onToggle={handleToggle}
      />

      <TransportRideTable items={rides} loading={loading} />
    </div>
  );
}
