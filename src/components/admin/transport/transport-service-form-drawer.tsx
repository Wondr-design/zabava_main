"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { adminApi } from "@/lib/web/api-client";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocalizedRouter } from "@/i18n/use-localized-router";

interface TransportServiceFormDrawerProps {
  onCreated?: () => void;
}

export function TransportServiceFormDrawer({ onCreated }: TransportServiceFormDrawerProps) {
  const [open, setOpen] = useState(false);
  const [serviceType, setServiceType] = useState<"taxi" | "bus" | "limo">("taxi");
  const [submitting, startSubmitting] = useTransition();
  const [error, setError] = useState("");
  const router = useLocalizedRouter();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button type="button" className="rounded-full px-4 py-2 text-sm font-semibold">
          New transport service
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <form
          className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            const form = event.currentTarget;
            startSubmitting(async () => {
              try {
                const formData = new FormData(form);
                const partnerId = String(formData.get("transport-partner") ?? "").trim();
                const name = String(formData.get("transport-name") ?? "").trim();
                const commissionPerRide = Number(formData.get("transport-commission") ?? 0);
                const qrValidityDays = Number(formData.get("transport-qr-validity") ?? 3);
                const notes = String(formData.get("transport-notes") ?? "").trim();

                if (!partnerId || !name) {
                  setError("Partner and service name are required.");
                  return;
                }

                await adminApi.transportServiceCreate(
                  {
                    partnerId,
                    name,
                    serviceType,
                    commissionPerRide,
                    qrValidityDays: Number.isFinite(qrValidityDays) && qrValidityDays > 0 ? qrValidityDays : 3,
                    notes: notes || undefined,
                  },
                  {},
                );

                toast.success("Transport service created");
                form.reset();
                setServiceType("taxi");
                setOpen(false);
                onCreated?.();
                router.refresh();
              } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to create transport service.";
                setError(message);
                toast.error(message);
              }
            });
          }}
        >
          <DrawerHeader className="space-y-2">
            <DrawerTitle>Create transport service</DrawerTitle>
            <DrawerDescription>
              Capture partner transport offerings and link them to ride logging.
            </DrawerDescription>
          </DrawerHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transport-name">Service name</Label>
              <Input id="transport-name" placeholder="e.g. City taxi" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport-partner">Partner ID</Label>
              <Input id="transport-partner" placeholder="partner-slug" required />
            </div>
            <div className="space-y-2">
              <Label>Service type</Label>
              <Select
                value={serviceType}
                onValueChange={(value) => setServiceType(value as typeof serviceType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="taxi">Taxi</SelectItem>
                  <SelectItem value="bus">Bus</SelectItem>
                  <SelectItem value="limo">Limousine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport-commission">Commission per ride (CZK)</Label>
              <Input id="transport-commission" type="number" min={0} step={1} placeholder="50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport-qr-validity">QR validity (days)</Label>
              <Input id="transport-qr-validity" type="number" min={1} step={1} placeholder="3" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transport-notes">Internal notes</Label>
            <textarea
              id="transport-notes"
              className="min-h-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Any special billing instructions, partner requests, or exclusions."
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DrawerFooter className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save service"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
