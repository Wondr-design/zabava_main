"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { partnerApi } from "@/lib/web/api-client";
import { useGlobalValues } from "@/hooks/use-global-values";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface QuickVisitFormProps {
  partnerId: string;
  onCreated: () => void;
}

export function QuickVisitForm({ partnerId, onCreated }: QuickVisitFormProps) {
  const [email, setEmail] = useState("");
  const [numPeople, setNumPeople] = useState<number>(1);
  const [totalPrice, setTotalPrice] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [ticketMode, setTicketMode] = useState<"select" | "custom">("select");
  const [selectedTicket, setSelectedTicket] = useState<string>("");
  const [customTicket, setCustomTicket] = useState<string>("");

  const { values: ticketTypes } = useGlobalValues("ticket_type", {
    includeInactive: false,
  });

  const ticketOptions = useMemo(
    () =>
      ticketTypes
        .filter((value) => value.isActive)
        .map((value) => ({
          key: value.key,
          label: value.label,
        })),
    [ticketTypes],
  );

  useEffect(() => {
    if (ticketOptions.length === 0) {
      setTicketMode("custom");
      return;
    }
    setTicketMode((prev) => (prev === "custom" ? prev : "select"));
    setSelectedTicket((prev) =>
      prev && ticketOptions.some((option) => option.key === prev)
        ? prev
        : ticketOptions[0]?.key ?? "",
    );
  }, [ticketOptions]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }

    const normalizedTicket =
      ticketMode === "select"
        ? selectedTicket.trim()
        : customTicket.trim();

    setLoading(true);
    try {
      await partnerApi.createVisit(
        {
          email: email.trim().toLowerCase(),
          partnerId,
          numPeople,
          ticketType: normalizedTicket || undefined,
          totalPrice: totalPrice ? Number(totalPrice) : undefined,
          payload: {},
        },
        {},
      );
      toast.success("Visit registered");
      setEmail("");
      setNumPeople(1);
      setTotalPrice("");
      setCustomTicket("");
      setSelectedTicket(ticketOptions[0]?.key ?? "");
      setTicketMode(ticketOptions.length > 0 ? "select" : "custom");
      onCreated();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to register visit";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const showSelect = ticketMode === "select" && ticketOptions.length > 0;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Quick visit
          </h2>
          <p className="text-xs text-muted-foreground">
            Capture a guest without asking them to complete the full form.
          </p>
        </div>
        {ticketOptions.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setTicketMode((prev) => (prev === "select" ? "custom" : "select"))
            }
          >
            {ticketMode === "select" ? "Use custom ticket" : "Use ticket list"}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="guest-email">
            Guest email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="guest-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="guest@example.com"
            autoComplete="email"
          />
          <p className="text-xs text-muted-foreground">
            We'll send the visit confirmation to this address.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="num-visitors">Number of visitors</Label>
          <Input
            id="num-visitors"
            type="number"
            min={1}
            value={numPeople}
            onChange={(event) =>
              setNumPeople(Number.parseInt(event.target.value, 10) || 1)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ticket-type">Ticket type</Label>
          {showSelect ? (
            <Select
              value={selectedTicket}
              onValueChange={(value) => setSelectedTicket(value)}
              disabled={loading}
            >
              <SelectTrigger id="ticket-type" aria-label="Select ticket type">
                <SelectValue placeholder="Select ticket type" />
              </SelectTrigger>
              <SelectContent>
                {ticketOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="ticket-type"
              value={customTicket}
              onChange={(event) => setCustomTicket(event.target.value)}
              placeholder="VIP, family, walk-in…"
            />
          )}
          <p className="text-xs text-muted-foreground">
            {showSelect
              ? "Choose from configured ticket types."
              : "Enter a ticket label to keep reporting consistent."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="estimated-spend">Estimated spend (CZK)</Label>
          <Input
            id="estimated-spend"
            type="number"
            inputMode="decimal"
            min={0}
            value={totalPrice}
            onChange={(event) => setTotalPrice(event.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <Button
        disabled={loading}
        className="w-full sm:w-auto"
      >
        {loading ? "Saving…" : "Register"}
      </Button>
    </form>
  );
}
