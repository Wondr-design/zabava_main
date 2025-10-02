"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { adminApi } from "@/lib/web/api-client";

export default function AdminRewardsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rewards, setRewards] = useState<any[]>([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all"|"active"|"inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  async function refresh() {
    try {
      setLoading(true);
      const res = await adminApi.rewardsList({});
      setRewards(Array.isArray((res as any).rewards) ? (res as any).rewards : []);
    } catch (e: any) {
      setError(e.message || "Failed to load rewards");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const filteredRewards = rewards.filter((r: any) => {
    const nameMatch = q ? (`${r.name} ${r.id}`.toLowerCase().includes(q.toLowerCase())) : true;
    const statusMatch = statusFilter === 'all' ? true : (r.status === statusFilter);
    const categoryMatch = categoryFilter === 'all' ? true : (r.category === categoryFilter);
    return nameMatch && statusMatch && categoryMatch;
  });

  function onNew() {
    setEditing({
      name: "",
      description: "",
      pointsCost: 1,
      category: "other",
      availableFor: [],
      stock: null,
      imageUrl: "",
      redemptionInstructions: "",
      validUntil: "",
      status: "active",
    });
    setOpen(true);
  }

  function onEdit(id: string) {
    const item = rewards.find((r) => r.id === id);
    if (!item) return;
    setEditing({ ...item });
    setOpen(true);
  }

  async function onArchive(id: string) {
    if (!confirm("Archive this reward?")) return;
    try {
      await adminApi.rewardDelete(id, {});
      toast.success("Reward archived");
      void refresh();
    } catch (e: any) {
      toast.error(e?.message || "Failed to archive reward");
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin · Rewards</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/70">Showing {filteredRewards.length} of {rewards.length}</span>
          <button onClick={() => { setQ(""); setStatusFilter("all"); setCategoryFilter("all"); }} className="rounded bg-slate-700 text-white px-3 py-2 text-sm">Clear filters</button>
          <button onClick={onNew} className="rounded bg-blue-600 text-white px-3 py-2 text-sm">New Reward</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-40">
          <label className="block text-sm">Search</label>
          <input className="w-full rounded border px-3 py-2 bg-white/80 text-black" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or ID" />
        </div>
        <div>
          <label className="block text-sm">Status</label>
          <select className="rounded border px-3 py-2 bg-white/80 text-black" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="block text-sm">Category</label>
          <select className="rounded border px-3 py-2 bg-white/80 text-black" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="discount">discount</option>
            <option value="freebie">freebie</option>
            <option value="experience">experience</option>
            <option value="merchandise">merchandise</option>
            <option value="other">other</option>
          </select>
        </div>
      </div>

      <div className="overflow-auto border rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-black/5">
            <tr>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Points</th>
              <th className="text-left p-2">Category</th>
              <th className="text-left p-2">Stock</th>
              <th className="text-left p-2">Visibility</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRewards.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{r.id}</td>
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.pointsCost} pts</td>
                <td className="p-2">{r.category}</td>
                <td className="p-2">{typeof r.stock === 'number' ? r.stock : '—'}</td>
                <td className="p-2">{Array.isArray(r.availableFor) && r.availableFor.length > 0 ? `${r.availableFor.length} partner${r.availableFor.length > 1 ? 's' : ''}` : 'All'}</td>
                <td className="p-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${r.status === 'active' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/40' : 'bg-slate-600/20 text-slate-300 border border-slate-600/40'}`}>{r.status}</span>
                </td>
                <td className="p-2 flex gap-2">
                  <button onClick={() => onEdit(r.id)} className="rounded bg-slate-700 text-white px-3 py-1">Edit</button>
                  <button onClick={() => onArchive(r.id)} className="rounded bg-red-600 text-white px-3 py-1">Archive</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RewardDialog open={open} onOpenChange={setOpen} reward={editing} onSaved={() => { setOpen(false); setEditing(null); void refresh(); }} />
    </div>
  );
}

function RewardDialog({ open, onOpenChange, reward, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; reward: any | null; onSaved: () => void }) {
  const isEdit = Boolean(reward?.id);
  const [name, setName] = useState(reward?.name || "");
  const [description, setDescription] = useState(reward?.description || "");
  const [pointsCost, setPointsCost] = useState<number>(reward?.pointsCost || 1);
  const [category, setCategory] = useState(reward?.category || "other");
  const [availableFor, setAvailableFor] = useState<string>((reward?.availableFor || []).join(', '));
  const [stock, setStock] = useState<string>(reward?.stock ?? "");
  const [imageUrl, setImageUrl] = useState(reward?.imageUrl || "");
  const [redemptionInstructions, setRedemptionInstructions] = useState(reward?.redemptionInstructions || "");
  const [validUntil, setValidUntil] = useState<string>(reward?.validUntil || "");
  const [status, setStatus] = useState(reward?.status || "active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [partners, setPartners] = useState<string[]>([]);
  const [partnerQuery, setPartnerQuery] = useState("");
  const [selectedPartners, setSelectedPartners] = useState<string[]>(Array.isArray(reward?.availableFor) ? reward!.availableFor : []);

  useEffect(() => {
    setName(reward?.name || "");
    setDescription(reward?.description || "");
    setPointsCost(reward?.pointsCost || 1);
    setCategory(reward?.category || "other");
    setAvailableFor((reward?.availableFor || []).join(', '));
    setStock(reward?.stock ?? "");
    setImageUrl(reward?.imageUrl || "");
    setRedemptionInstructions(reward?.redemptionInstructions || "");
    setValidUntil(reward?.validUntil || "");
    setStatus(reward?.status || "active");
    setSelectedPartners(Array.isArray(reward?.availableFor) ? reward!.availableFor : []);
    setError("");
  }, [reward]);

  useEffect(() => {
    // Fetch partners for multiselect
    (async () => {
      try {
        const res = await adminApi.partnersList({});
        const ids = Array.isArray((res as any).items) ? (res as any).items.map((p: any) => p.partnerId || p.id).filter(Boolean) : [];
        setPartners(ids);
      } catch {
        setPartners([]);
      }
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const availableFromText = availableFor.split(',').map((s) => s.trim()).filter(Boolean);
      const selected = selectedPartners;
      const payload: any = {
        name: name.trim(),
        description: description.trim() || undefined,
        pointsCost,
        category,
        availableFor: selected.length ? selected : availableFromText,
        stock: stock === "" ? undefined : Number(stock),
        imageUrl: imageUrl.trim() || undefined,
        redemptionInstructions: redemptionInstructions.trim() || undefined,
        validUntil: validUntil || undefined,
        status,
      };
      if (!payload.name || !payload.pointsCost) {
        setError("Name and points are required");
        setSaving(false);
        return;
      }

      if (isEdit) {
        await adminApi.rewardUpdate(reward.id, payload, {});
        toast.success("Reward updated");
      } else {
        await adminApi.rewardCreate(payload, {});
        toast.success("Reward created");
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Failed to save reward");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white text-black rounded-xl p-4">
          <Dialog.Title className="text-lg font-semibold mb-2">{isEdit ? "Edit Reward" : "New Reward"}</Dialog.Title>
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-sm">Name</label>
              <input className="w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-sm">Description</label>
              <textarea className="w-full rounded border px-3 py-2 min-h-24" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Points</label>
              <input className="w-full rounded border px-3 py-2" type="number" min={1} value={pointsCost} onChange={(e) => setPointsCost(Number(e.target.value || 1))} />
            </div>
            <div>
              <label className="text-sm">Category</label>
              <select className="w-full rounded border px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="discount">discount</option>
                <option value="freebie">freebie</option>
                <option value="experience">experience</option>
                <option value="merchandise">merchandise</option>
                <option value="other">other</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-sm">Available for (partner IDs, comma separated)</label>
              <input className="w-full rounded border px-3 py-2 mb-2" value={availableFor} onChange={(e) => setAvailableFor(e.target.value)} />
              <div className="rounded border p-2 max-h-40 overflow-auto bg-white/60">
                <div className="flex items-end gap-2 mb-2">
                  <input className="flex-1 rounded border px-2 py-1" placeholder="Filter partners" value={partnerQuery} onChange={(e) => setPartnerQuery(e.target.value)} />
                  <button type="button" className="rounded bg-slate-700 text-white px-2 py-1" onClick={() => setSelectedPartners(partners)}>Select all</button>
                  <button type="button" className="rounded bg-slate-700 text-white px-2 py-1" onClick={() => setSelectedPartners([])}>Clear</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {partners
                    .filter((id) => (partnerQuery ? id.toLowerCase().includes(partnerQuery.toLowerCase()) : true))
                    .map((id) => {
                      const checked = selectedPartners.includes(id);
                      return (
                        <label key={id} className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={checked} onChange={(e) => {
                            if (e.target.checked) setSelectedPartners([...selectedPartners, id]);
                            else setSelectedPartners(selectedPartners.filter((p) => p !== id));
                          }} />
                          <span>{id}</span>
                        </label>
                      );
                    })}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedPartners.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-700 text-white px-2 py-0.5 text-xs">
                    {id}
                    <button type="button" className="ml-1" onClick={() => setSelectedPartners(selectedPartners.filter((p) => p !== id))}>×</button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm">Stock (optional)</label>
              <input className="w-full rounded border px-3 py-2" type="number" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Status</label>
              <select className="w-full rounded border px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-sm">Image URL</label>
              <input className="w-full rounded border px-3 py-2" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              {imageUrl && (
                <div className="mt-2">
                  <img src={imageUrl} alt="Reward image preview" className="max-h-32 rounded border" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="text-sm">Redemption instructions</label>
              <textarea className="w-full rounded border px-3 py-2 min-h-20" value={redemptionInstructions} onChange={(e) => setRedemptionInstructions(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-sm">Valid until (optional)</label>
              <input className="w-full rounded border px-3 py-2" type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
            {error && <div className="col-span-2 text-sm text-red-600">{error}</div>}
            <div className="col-span-2 flex justify-end gap-2">
              <Dialog.Close className="rounded bg-slate-600 text-white px-4 py-2">Cancel</Dialog.Close>
              <button disabled={saving} className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
