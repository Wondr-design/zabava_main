"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { RefreshButton } from "@/components/ui/refresh-button";
import { adminApi } from "@/lib/web/api-client";
import type { PartnerMeta, PartnerNoteEntry } from "@/lib/data/partners";
import { ImageUploadField } from "@/components/admin/media/image-upload-field";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useLocalizedRouter } from "@/i18n/use-localized-router";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-white/80">{label}</label>
      {children}
    </div>
  );
}

function legacyNotesToText(
  notes: PartnerMeta["notes"] | string | null | undefined,
) {
  if (Array.isArray(notes)) {
    return notes.map((note) => note.body).join("\n\n");
  }
  if (typeof notes === "string") return notes;
  return "";
}

function legacyTextToNotes(value: string): PartnerNoteEntry[] {
  return value
    .split(/\n{2,}/)
    .map((body) => body.trim())
    .filter((body) => body.length > 0)
    .map((body) => ({
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
      body,
      createdAt: new Date().toISOString(),
    }));
}

export default function AdminPartnerDetailPage() {
  const router = useLocalizedRouter();
  const params = useParams<{ id: string }>();
  const [partnerId, setPartnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [status, setStatus] = useState("active");
  const [displayName, setDisplayName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [ticketTypes, setTicketTypes] = useState<string>("");
  const [familyRule, setFamilyRule] = useState<string>("");
  const [monthlyFee, setMonthlyFee] = useState<string>("");
  const [discountRate, setDiscountRate] = useState<string>("");
  const [commissionRate, setCommissionRate] = useState<string>("");
  const [commissionBasis, setCommissionBasis] =
    useState<"original" | "discounted">("discounted");
  const [payments, setPayments] = useState<string>("");
  const [facilities, setFacilities] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [heroImageUrl, setHeroImageUrl] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [bonusProgramEnabled, setBonusProgramEnabled] = useState(false);
  const [notes, setNotes] = useState("");
  const [billingStart, setBillingStart] = useState("");
  const [billingEnd, setBillingEnd] = useState("");
  const [billingNotes, setBillingNotes] = useState("");
  const [billingSending, setBillingSending] = useState(false);
  const [billingSuccess, setBillingSuccess] = useState<string | null>(null);
  const commissionSliderValue = Math.min(
    Math.max(Number(commissionRate) || 1, 1),
    100,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.partnerGet(partnerId, {});
      const item = res.item as PartnerMeta | null;
      if (!item) throw new Error("Partner not found");
      setStatus(item.status ?? "active");
      setDisplayName(item.displayName ?? partnerId);
      setContactName(item.info.contactName ?? "");
      setContactEmail(item.info.contactEmail ?? "");
      setWebsite(item.info.website ?? "");
      setTicketTypes(item.ticketing.ticketTypes.join(", "));
      setFamilyRule(item.ticketing.familyRule ?? "");
      setMonthlyFee(String(item.contract.monthlyFee ?? ""));
      setDiscountRate(String(item.contract.discountRate ?? ""));
      setCommissionRate(String(item.contract.commissionRate ?? ""));
      setCommissionBasis(item.contract.commissionBasis);
      setPayments(item.info.payments.join(", "));
      setFacilities(item.info.facilities.join(", "));
      setLogoUrl(item.media.logoUrl ?? "");
      setHeroImageUrl(item.media.heroImageUrl ?? "");
      setTags(item.tags.join(", "));
      setBonusProgramEnabled(Boolean(item.bonusProgramEnabled));
      setNotes(legacyNotesToText(item.notes));
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load partner";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    if (params?.id) {
      setPartnerId(params.id.toLowerCase());
    }
  }, [params]);

  useEffect(() => {
    if (partnerId) void load();
  }, [partnerId, load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const tt = ticketTypes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const pay = payments
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const fac = facilities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const tagVals = tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await adminApi.partnerUpdate(
        partnerId,
        {
          displayName,
          status,
          contract: {
            monthlyFee: monthlyFee ? Number(monthlyFee) : undefined,
            discountRate: discountRate ? Number(discountRate) : undefined,
            commissionRate: commissionRate ? Number(commissionRate) : undefined,
            commissionBasis,
          },
          ticketing: {
            ticketTypes: tt,
            familyRule: familyRule || undefined,
          },
          info: {
            contactName,
            contactEmail,
            website,
            payments: pay,
            facilities: fac,
          },
          media: {
            logoUrl: logoUrl || undefined,
            heroImageUrl: heroImageUrl || undefined,
          },
          bonusProgramEnabled,
          tags: tagVals,
          notes: legacyTextToNotes(notes),
        },
        {},
      );
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save partner";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function sendBillingRequest() {
    setBillingSending(true);
    setError("");
    setBillingSuccess(null);
    try {
      await adminApi.partnerSendBill(
        partnerId,
        {
          periodStart: billingStart || undefined,
          periodEnd: billingEnd || undefined,
          notes: billingNotes || undefined,
        },
        {},
      );
      setBillingSuccess("Billing request sent.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to send billing request";
      setError(message);
    } finally {
      setBillingSending(false);
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            Admin · Partner · {partnerId}
          </h1>
          <RefreshButton onRefresh={load} label="Refresh data" />
        </div>
        <LocalizedLink
          className="rounded bg-slate-700 px-3 py-1 text-sm text-white hover:bg-slate-600"
          href="/admin/partners"
        >
          Back
        </LocalizedLink>
      </div>

      <form
        onSubmit={save}
        className="grid grid-cols-1 gap-4 rounded-xl border p-4 md:grid-cols-2"
      >
        <Field label="Display name">
          <input
            className="rounded border bg-white/80 px-3 py-2 text-black"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            className="rounded border bg-white/80 px-3 py-2 text-black"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="hidden">hidden</option>
          </select>
        </Field>
        <Field label="Contract · Monthly fee">
          <input
            className="rounded border bg-white/80 px-3 py-2 text-black"
            value={monthlyFee}
            onChange={(e) => setMonthlyFee(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Contract · Discount rate (%)">
          <input
            className="rounded border bg-white/80 px-3 py-2 text-black"
            value={discountRate}
            onChange={(e) => setDiscountRate(e.target.value)}
            placeholder="0-100"
          />
        </Field>
        <Field label="Contract · Commission rate (%)">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={100}
              value={commissionSliderValue}
              onChange={(e) => setCommissionRate(e.target.value)}
              className="flex-1 accent-emerald-500"
            />
            <input
              className="w-20 rounded border bg-white/80 px-3 py-2 text-black"
              value={commissionRate}
              onChange={(e) => {
                const next = e.target.value.replace(/[^0-9]/g, "");
                setCommissionRate(next);
              }}
              type="number"
              min={1}
              max={100}
              placeholder="1-100"
            />
          </div>
        </Field>
        <Field label="Contract · Commission basis">
          <select
            className="rounded border bg-white/80 px-3 py-2 text-black"
            value={commissionBasis}
            onChange={(e) =>
              setCommissionBasis(e.target.value as "original" | "discounted")
            }
          >
            <option value="original">original</option>
            <option value="discounted">discounted</option>
          </select>
        </Field>
        <Field label="Contact name">
          <input
            className="rounded border bg-white/80 px-3 py-2 text-black"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </Field>
        <Field label="Contact email">
          <input
            className="rounded border bg-white/80 px-3 py-2 text-black"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </Field>
        <Field label="Website">
          <input
            className="rounded border bg-white/80 px-3 py-2 text-black"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </Field>
        <Field label="Ticket types (comma separated)">
          <input
            className="rounded border bg-white/80 px-3 py-2 text-black"
            value={ticketTypes}
            onChange={(e) => setTicketTypes(e.target.value)}
          />
        </Field>
        <Field label="Ticketing · Family rule">
          <input
            className="rounded border bg-white/80 px-3 py-2 text-black"
            value={familyRule}
            onChange={(e) => setFamilyRule(e.target.value)}
          />
        </Field>
        <Field label="Payments (comma separated)">
          <input
            className="rounded border bg-white/80 px-3 py-2 text-black"
            value={payments}
            onChange={(e) => setPayments(e.target.value)}
          />
        </Field>
        <Field label="Facilities (comma separated)">
          <input
            className="rounded border bg-white/80 px-3 py-2 text-black"
            value={facilities}
            onChange={(e) => setFacilities(e.target.value)}
          />
        </Field>
        <div className="space-y-1">
          <label className="text-sm text-white/80">Media · Logo</label>
          <ImageUploadField
            label="Upload logo"
            value={logoUrl}
            onChange={setLogoUrl}
            folder={`partners/${partnerId || "new"}/logo`}
            helperText="Shown in internal tools and partner embeds."
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-white/80">Media · Hero image</label>
          <ImageUploadField
            label="Upload hero image"
            value={heroImageUrl}
            onChange={setHeroImageUrl}
            folder={`partners/${partnerId || "new"}/hero`}
            helperText="Displayed across the public site and partner carousel."
          />
        </div>
        <Field label="Tags (comma separated)">
          <input
            className="rounded border bg-white/80 px-3 py-2 text-black"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </Field>
        <div className="flex items-center gap-2">
          <input
            id="bonus"
            type="checkbox"
            checked={bonusProgramEnabled}
            onChange={(e) => setBonusProgramEnabled(e.target.checked)}
          />
          <label htmlFor="bonus">Bonus program enabled</label>
        </div>
        <Field label="Notes">
          <textarea
            className="min-h-24 rounded border bg-white/80 px-3 py-2 text-black"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        {error && (
          <div className="md:col-span-2 text-sm text-red-500">{error}</div>
        )}
        <div className="md:col-span-2">
          <button
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>

      <div className="space-y-4 rounded-xl border bg-slate-900/60 p-4 text-white">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Send monthly billing</h2>
          <p className="text-sm text-white/70">
            Trigger the automation workflow to email this partner&apos;s invoice and
            commission summary.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Period start">
            <input
              type="date"
              className="rounded border bg-white/90 px-3 py-2 text-black"
              value={billingStart}
              onChange={(event) => setBillingStart(event.target.value)}
            />
          </Field>
          <Field label="Period end">
            <input
              type="date"
              className="rounded border bg-white/90 px-3 py-2 text-black"
              value={billingEnd}
              onChange={(event) => setBillingEnd(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Notes (optional)">
          <textarea
            className="min-h-[80px] rounded border bg-white/90 px-3 py-2 text-black"
            value={billingNotes}
            onChange={(event) => setBillingNotes(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={sendBillingRequest}
            disabled={billingSending}
            className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
          >
            {billingSending ? "Sending…" : "Send billing request"}
          </button>
          {billingSuccess ? (
            <span className="text-sm text-emerald-400">{billingSuccess}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
