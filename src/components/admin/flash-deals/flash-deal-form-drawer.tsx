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
import { useLocalizedRouter } from "@/i18n/use-localized-router";

interface FlashDealFormDrawerProps {
  onCreated?: () => void;
}

export function FlashDealFormDrawer({ onCreated }: FlashDealFormDrawerProps) {
  const [open, setOpen] = useState(false);
  const [submitting, startSubmitting] = useTransition();
  const [error, setError] = useState<string>("");
  const router = useLocalizedRouter();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button type="button" className="rounded-full px-4 py-2 text-sm font-semibold">
          New flash deal
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-background">
        <form
          className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            const form = event.currentTarget;
            startSubmitting(async () => {
              try {
                const formData = new FormData(form);
                const partnerId = String(formData.get("flash-partner") ?? "").trim();
                const title = String(formData.get("flash-title") ?? "").trim();
                const description = String(formData.get("flash-description") ?? "").trim();
                const discountPercent = Number(formData.get("flash-discount") ?? 0);
                const commissionPercent = Number(formData.get("flash-commission") ?? 0);
                const minVisitors = Number(formData.get("flash-min-visitors") ?? 1);
                const usageLimitRaw = formData.get("flash-usage-limit") as string | null;
                const validFromRaw = formData.get("flash-valid-from") as string | null;
                const validToRaw = formData.get("flash-valid-to") as string | null;

                if (!partnerId || !title) {
                  setError("Partner and title are required.");
                  return;
                }

                await adminApi.flashDealCreate({
                  partnerId,
                  title,
                  description: description || undefined,
                  discountPercent,
                  commissionPercent,
                  minVisitors: Number.isFinite(minVisitors) && minVisitors > 0 ? minVisitors : 1,
                  usageLimit:
                    usageLimitRaw && usageLimitRaw.trim()
                      ? Number(usageLimitRaw)
                      : undefined,
                  validFrom: validFromRaw && validFromRaw.length ? new Date(validFromRaw).toISOString() : undefined,
                  validTo: validToRaw && validToRaw.length ? new Date(validToRaw).toISOString() : undefined,
                });

                toast.success("Flash deal created");
                setOpen(false);
                form.reset();
                onCreated?.();
                router.refresh();
              } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to create flash deal.";
                setError(message);
                toast.error(message);
              }
            });
          }}
        >
          <DrawerHeader className="space-y-2">
            <DrawerTitle>Create flash deal</DrawerTitle>
            <DrawerDescription>
              Configure a time-limited offer. Published deals can be activated from the table.
            </DrawerDescription>
          </DrawerHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="flash-title">Title</Label>
              <Input id="flash-title" placeholder="e.g. Winter family bundle" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flash-partner">Partner ID</Label>
              <Input id="flash-partner" placeholder="partner-slug" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flash-discount">Discount %</Label>
              <Input id="flash-discount" type="number" min={0} max={100} step={0.5} placeholder="15" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flash-commission">Commission %</Label>
              <Input id="flash-commission" type="number" min={0} max={100} step={0.5} placeholder="10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flash-min-visitors">Minimum visitors</Label>
              <Input id="flash-min-visitors" type="number" min={1} step={1} placeholder="2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flash-usage-limit">Usage limit</Label>
              <Input id="flash-usage-limit" type="number" min={1} step={1} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flash-valid-from">Valid from</Label>
              <Input id="flash-valid-from" type="datetime-local" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flash-valid-to">Valid to</Label>
              <Input id="flash-valid-to" type="datetime-local" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="flash-description">Description</Label>
            <textarea
              id="flash-description"
              className="min-h-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Describe benefits, disclaimers, or visit requirements…"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DrawerFooter className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save flash deal"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
