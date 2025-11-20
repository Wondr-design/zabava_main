"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { partnerApi } from "@/lib/web/api-client";
import { useGlobalValues } from "@/hooks/use-global-values";
import {
  DesignButton,
  DesignFormField,
  DesignInput,
  DesignSelect,
  DesignSelectContent,
  DesignSelectItem,
  DesignSelectTrigger,
  DesignSelectValue,
} from "@/components/design-system";

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
          <h2 className="text-sm font-semibold text-[color:var(--ds-text-strong)]">
            Quick visit
          </h2>
          <p className="text-xs text-[color:var(--ds-text-muted)]">
            Capture a guest without asking them to complete the full form.
          </p>
        </div>
        {ticketOptions.length > 0 ? (
          <DesignButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setTicketMode((prev) => (prev === "select" ? "custom" : "select"))
            }
          >
            {ticketMode === "select" ? "Use custom ticket" : "Use ticket list"}
          </DesignButton>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DesignFormField
          label="Guest email"
          required
          className="sm:col-span-2"
          helper="We’ll send the visit confirmation to this address."
        >
          <DesignInput
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="guest@example.com"
            autoComplete="email"
          />
        </DesignFormField>

        <DesignFormField label="Number of visitors">
          <DesignInput
            type="number"
            min={1}
            value={numPeople}
            onChange={(event) =>
              setNumPeople(Number.parseInt(event.target.value, 10) || 1)
            }
          />
        </DesignFormField>

        <DesignFormField
          label="Ticket type"
          description={
            showSelect
              ? "Choose from configured ticket types."
              : "Enter a ticket label to keep reporting consistent."
          }
        >
          {showSelect ? (
            <DesignSelect
              value={selectedTicket}
              onValueChange={(value) => setSelectedTicket(value)}
              disabled={loading}
            >
              <DesignSelectTrigger aria-label="Select ticket type">
                <DesignSelectValue placeholder="Select ticket type" />
              </DesignSelectTrigger>
              <DesignSelectContent>
                {ticketOptions.map((option) => (
                  <DesignSelectItem key={option.key} value={option.key}>
                    {option.label}
                  </DesignSelectItem>
                ))}
              </DesignSelectContent>
            </DesignSelect>
          ) : (
            <DesignInput
              value={customTicket}
              onChange={(event) => setCustomTicket(event.target.value)}
              placeholder="VIP, family, walk-in…"
            />
          )}
        </DesignFormField>

        <DesignFormField label="Estimated spend (CZK)">
          <DesignInput
            type="number"
            inputMode="decimal"
            min={0}
            value={totalPrice}
            onChange={(event) => setTotalPrice(event.target.value)}
            placeholder="Optional"
          />
        </DesignFormField>
      </div>

      <DesignButton
        disabled={loading}
        className="w-full sm:w-auto"
      >
        {loading ? "Saving…" : "Register"}
      </DesignButton>
    </form>
  );
}
