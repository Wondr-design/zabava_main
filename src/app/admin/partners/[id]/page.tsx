"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/web/api-client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-white/80">{label}</label>
      {children}
    </div>
  );
}

export default function AdminPartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
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
  const [commissionBasis, setCommissionBasis] = useState<'original' | 'discounted'>('discounted');
  const [payments, setPayments] = useState<string>("");
  const [facilities, setFacilities] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [heroImageUrl, setHeroImageUrl] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [bonusProgramEnabled, setBonusProgramEnabled] = useState(false);
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.partnerGet(partnerId, {});
      const item = (res as any).item;
      if (!item) throw new Error("Partner not found");
      setStatus(item.status || "active");
      setDisplayName(item.displayName || partnerId);
      setContactName(item.info?.contactName || "");
      setContactEmail(item.info?.contactEmail || "");
      setWebsite(item.info?.website || "");
      setTicketTypes((item.ticketing?.ticketTypes || []).join(", "));
      setFamilyRule(item.ticketing?.familyRule || "");
      setMonthlyFee(String(item.contract?.monthlyFee ?? ''));
      setDiscountRate(String(item.contract?.discountRate ?? ''));
      setCommissionRate(String(item.contract?.commissionRate ?? ''));
      setCommissionBasis((item.contract?.commissionBasis === 'original' ? 'original' : 'discounted'));
      setPayments((item.info?.payments || []).join(', '));
      setFacilities((item.info?.facilities || []).join(', '));
      setLogoUrl(item.media?.logoUrl || "");
      setHeroImageUrl(item.media?.heroImageUrl || "");
      setTags((item.tags || []).join(', '));
      setBonusProgramEnabled(Boolean(item.bonusProgramEnabled));
      setNotes(item.notes || "");
    } catch (e: any) {
      setError(e.message || "Failed to load partner");
    } finally {
      setLoading(false);
    }
  }

useEffect(() => {
  let alive = true;
  (async () => {
    try {
      const { id } = await params;
      if (alive) setPartnerId((id || '').toLowerCase());
    } catch {}
  })();
  return () => { alive = false; };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [params]);

useEffect(() => { if (partnerId) void load(); }, [partnerId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const tt = ticketTypes.split(",").map(s => s.trim()).filter(Boolean);
      const pay = payments.split(',').map(s => s.trim()).filter(Boolean);
      const fac = facilities.split(',').map(s => s.trim()).filter(Boolean);
      const tagVals = tags.split(',').map(s => s.trim()).filter(Boolean);
      await adminApi.partnerUpdate(partnerId, {
        displayName,
        status,
        contract: {
          monthlyFee: monthlyFee ? Number(monthlyFee) : undefined,
          discountRate: discountRate ? Number(discountRate) : undefined,
          commissionRate: commissionRate ? Number(commissionRate) : undefined,
          commissionBasis,
        },
        ticketing: { ticketTypes: tt, familyRule: familyRule || undefined },
        info: { contactName, contactEmail, website, payments: pay, facilities: fac },
        media: { logoUrl: logoUrl || undefined, heroImageUrl: heroImageUrl || undefined },
        bonusProgramEnabled,
        tags: tagVals,
        notes: notes || undefined,
      }, {});
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Failed to save partner");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin · Partner · {partnerId}</h1>
        <a className="rounded bg-slate-700 px-3 py-1 text-sm" href="/admin/partners">Back</a>
      </div>

      <form onSubmit={save} className="grid gap-4 grid-cols-1 md:grid-cols-2 border rounded-xl p-4">
        <Field label="Display name">
          <input className="rounded border bg-white/80 text-black px-3 py-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Field label="Status">
          <select className="rounded border bg-white/80 text-black px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="hidden">hidden</option>
          </select>
        </Field>
        <Field label="Contract · Monthly fee">
          <input className="rounded border bg-white/80 text-black px-3 py-2" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Contract · Discount rate (%)">
          <input className="rounded border bg-white/80 text-black px-3 py-2" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} placeholder="0-100" />
        </Field>
        <Field label="Contract · Commission rate (%)">
          <input className="rounded border bg-white/80 text-black px-3 py-2" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} placeholder="0-100" />
        </Field>
        <Field label="Contract · Commission basis">
          <select className="rounded border bg-white/80 text-black px-3 py-2" value={commissionBasis} onChange={(e) => setCommissionBasis(e.target.value as any)}>
            <option value="original">original</option>
            <option value="discounted">discounted</option>
          </select>
        </Field>
        <Field label="Contact name">
          <input className="rounded border bg-white/80 text-black px-3 py-2" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </Field>
        <Field label="Contact email">
          <input className="rounded border bg-white/80 text-black px-3 py-2" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </Field>
        <Field label="Website">
          <input className="rounded border bg-white/80 text-black px-3 py-2" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </Field>
        <Field label="Ticket types (comma separated)">
          <input className="rounded border bg-white/80 text-black px-3 py-2" value={ticketTypes} onChange={(e) => setTicketTypes(e.target.value)} />
        </Field>
        <Field label="Ticketing · Family rule">
          <input className="rounded border bg-white/80 text-black px-3 py-2" value={familyRule} onChange={(e) => setFamilyRule(e.target.value)} />
        </Field>
        <Field label="Payments (comma separated)">
          <input className="rounded border bg-white/80 text-black px-3 py-2" value={payments} onChange={(e) => setPayments(e.target.value)} />
        </Field>
        <Field label="Facilities (comma separated)">
          <input className="rounded border bg-white/80 text-black px-3 py-2" value={facilities} onChange={(e) => setFacilities(e.target.value)} />
        </Field>
        <Field label="Media · Logo URL">
          <input className="rounded border bg-white/80 text-black px-3 py-2" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </Field>
        <Field label="Media · Hero image URL">
          <input className="rounded border bg-white/80 text-black px-3 py-2" value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} />
        </Field>
        <Field label="Tags (comma separated)">
          <input className="rounded border bg-white/80 text-black px-3 py-2" value={tags} onChange={(e) => setTags(e.target.value)} />
        </Field>
        <div className="flex items-center gap-2">
          <input id="bonus" type="checkbox" checked={bonusProgramEnabled} onChange={(e) => setBonusProgramEnabled(e.target.checked)} />
          <label htmlFor="bonus">Bonus program enabled</label>
        </div>
        <Field label="Notes">
          <textarea className="rounded border bg-white/80 text-black px-3 py-2 min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <div className="md:col-span-2 text-sm text-red-500">{error}</div>}
        <div className="md:col-span-2">
          <button disabled={saving} className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-60">{saving ? "Saving..." : "Save changes"}</button>
        </div>
      </form>
    </div>
  );
}
