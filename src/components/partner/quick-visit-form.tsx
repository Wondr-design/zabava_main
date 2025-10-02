"use client";

import { useState } from "react";
import { toast } from "sonner";
import { partnerApi } from "@/lib/web/api-client";

export function QuickVisitForm({ partnerId, onCreated }: { partnerId: string; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [numPeople, setNumPeople] = useState<number>(1);
  const [ticketType, setTicketType] = useState<string>("");
  const [totalPrice, setTotalPrice] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { toast.error("Email is required"); return; }
    setLoading(true);
    try {
      await partnerApi.createVisit({
        email: email.trim().toLowerCase(),
        partnerId,
        numPeople,
        ticketType: ticketType || undefined,
        totalPrice: totalPrice ? Number(totalPrice) : undefined,
        payload: {},
      }, {});
      toast.success("Visit registered");
      setEmail(""); setNumPeople(1); setTicketType(""); setTotalPrice("");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Failed to register visit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Quick visit</h2>
      <div className="grid grid-cols-2 gap-2">
        <input className="col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none" placeholder="Num people" type="number" min={1} value={numPeople} onChange={(e) => setNumPeople(Number(e.target.value || 1))} />
        <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none" placeholder="Ticket type (optional)" value={ticketType} onChange={(e) => setTicketType(e.target.value)} />
        <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none" placeholder="Total price (optional)" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} />
      </div>
      <button disabled={loading} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Saving…" : "Register"}</button>
    </form>
  );
}
