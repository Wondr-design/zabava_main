"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminApi } from "@/lib/web/api-client";

interface FilePayload {
  filename: string;
  contentType: string;
  base64: string;
}

function downloadFile(payload: FilePayload) {
  if (typeof window === "undefined") return;
  const binary = atob(payload.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: payload.contentType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = payload.filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  return {
    start,
    end,
  };
}

export function DealUsageExportDialog() {
  const defaults = useMemo(() => defaultRange(), []);
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(formatDateInput(defaults.start));
  const [dateTo, setDateTo] = useState(formatDateInput(defaults.end));
  const [partnerId, setPartnerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting) return;
      try {
        setSubmitting(true);
        const dateFromIso = dateFrom
          ? new Date(`${dateFrom}T00:00:00Z`).toISOString()
          : undefined;
        const dateToIso = dateTo
          ? new Date(`${dateTo}T23:59:59Z`).toISOString()
          : undefined;

        const result = await adminApi.flashDealUsageExport(
          {
            dateFrom: dateFromIso,
            dateTo: dateToIso,
            partnerId: partnerId.trim() ? partnerId.trim() : undefined,
          },
          {},
        );

        downloadFile(result.files.csv);
        downloadFile(result.files.xlsx);

        toast.success("Flash-deal usage export ready", {
          description: `${result.summary.used.toLocaleString()} used · ${result.summary.pending.toLocaleString()} pending · ${result.summary.rejected.toLocaleString()} rejected`,
        });
        setOpen(false);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to export flash-deal usage.";
        toast.error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [dateFrom, dateTo, partnerId, submitting],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={submitting}>
          {submitting ? "Preparing export…" : "Export usage"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export flash-deal usage</DialogTitle>
          <DialogDescription>
            Download CSV and XLSX files summarising flash-deal redemptions. You can limit the export to a specific partner or time window.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                From (UTC)
              </span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                max={dateTo}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                To (UTC)
              </span>
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                min={dateFrom}
                required
              />
            </label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="usage-export-partner">Partner ID (optional)</Label>
            <Input
              id="usage-export-partner"
              placeholder="partner-123"
              value={partnerId}
              onChange={(event) => setPartnerId(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to export usage for all partners.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Preparing…" : "Generate export"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
