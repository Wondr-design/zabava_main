"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { PartnerInviteDTO } from "@/lib/data/invites";
import type {
  PartnerShowcaseDirectory,
  PartnerShowcaseEntry,
} from "@/lib/data/partner-showcase";
import type { PartnerMeta, PartnerNoteEntry } from "@/lib/data/partners";
import type { PartnerOverview } from "@/lib/data/analytics";
import { adminApi } from "@/lib/web/api-client";
import { getCsrfToken } from "@/lib/web/csrf";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PartnerInviteForm,
  PartnerInviteFormState,
} from "@/components/partners/partner-invite-form";
import { PartnerInviteTable } from "@/components/partners/partner-invite-table";
import { PartnerDetailEditor } from "@/components/admin/partners/partner-detail-editor";
import { Separator } from "@/components/ui/separator";
import { MultiSelect } from "@/components/ui/multi-select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PartnersTable } from "@/components/partners/partners-table";
import { useGlobalValues } from "@/hooks/use-global-values";
import { ensureExternalUrl } from "@/lib/utils/url";

interface PartnersDashboardProps {
  overviewPartners: PartnerOverview[];
  directory: PartnerShowcaseDirectory;
  invites: PartnerInviteDTO[];
  createInviteAction: (
    prevState: PartnerInviteFormState,
    formData: FormData
  ) => Promise<PartnerInviteFormState>;
  deleteInviteAction: (formData: FormData) => Promise<void>;
}

interface CreatePartnerForm {
  partnerId: string;
  displayName: string;
  status: "active" | "pending" | "hidden";
  type: "standard" | "transport" | "taxi";
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  companyName: string;
  businessName: string;
  shortDescription: string;
  website: string;
  googleMapUrl: string;
  companyIdNumber: string;
  companyAddressCity: string;
  companyAddressLine: string;
  businessAddressCity: string;
  businessAddressLine: string;
  businessSameAsCompany: boolean;
  vatRegistered: boolean;
  vatRate: string;
  listingTierKey: string;
  monthlyFee: string;
  discountRate: string;
  commissionBasis: "original" | "discounted";
  notes: PartnerNoteEntry[];
  commissionRate: number;
  assignedStandardPartners: string[];
}

function parseOptionalNumber(
  value: string,
  label: string,
  options: { min?: number; max?: number } = {}
) {
  if (!value.trim()) return undefined;
  const normalized = Number(value.replace(",", "."));
  if (!Number.isFinite(normalized)) {
    throw new Error(`${label} must be a valid number.`);
  }
  if (options.min !== undefined && normalized < options.min) {
    throw new Error(`${label} must be at least ${options.min}.`);
  }
  if (options.max !== undefined && normalized > options.max) {
    throw new Error(`${label} must be at most ${options.max}.`);
  }
  return normalized;
}

function mapMetaToOverview(
  meta: PartnerMeta,
  listingTierLookup: Map<string, string>,
  fallback?: PartnerOverview
): PartnerOverview {
  const normalizedStatus =
    meta.status === "hidden"
      ? "inactive"
      : meta.status === "pending"
      ? "pending"
      : "active";
  return {
    id: meta.partnerId,
    display_name: meta.displayName ?? meta.partnerId,
    status: normalizedStatus,
    type: meta.type,
    created_at:
      fallback?.created_at ?? meta?.createdAt ?? new Date().toISOString(),
    memberCount: fallback?.memberCount ?? 0,
    visitCount: fallback?.visitCount ?? 0,
    pendingCount: fallback?.pendingCount ?? 0,
    listingTierKey: meta.listingTierKey ?? null,
    listingTierLabel: meta.listingTierKey
      ? listingTierLookup.get(meta.listingTierKey) ?? meta.listingTierKey
      : null,
    companyName: meta.info.companyName ?? "",
    businessName: meta.info.businessName ?? "",
    contactName: meta.info.contactName ?? "",
    contactEmail: meta.info.contactEmail ?? "",
    contactPhone: meta.info.contactPhone ?? "",
    website: meta.info.website ?? "",
    monthlyFee:
      typeof meta.contract.monthlyFee === "number"
        ? meta.contract.monthlyFee
        : null,
    discountRate:
      typeof meta.contract.discountRate === "number"
        ? meta.contract.discountRate
        : null,
    commissionBasis: meta.contract.commissionBasis ?? "discounted",
    commissionRate:
      typeof meta.contract.commissionRate === "number"
        ? meta.contract.commissionRate
        : null,
  };
}

const DEFAULT_CREATE_FORM: CreatePartnerForm = {
  partnerId: "",
  displayName: "",
  status: "active",
  type: "standard",
  contactEmail: "",
  contactName: "",
  contactPhone: "",
  companyName: "",
  businessName: "",
  shortDescription: "",
  website: "",
  googleMapUrl: "",
  companyIdNumber: "",
  companyAddressCity: "",
  companyAddressLine: "",
  businessAddressCity: "",
  businessAddressLine: "",
  businessSameAsCompany: true,
  vatRegistered: false,
  vatRate: "21",
  listingTierKey: "",
  monthlyFee: "",
  discountRate: "",
  commissionBasis: "discounted",
  notes: [],
  commissionRate: 10,
  assignedStandardPartners: [],
};

export function PartnersDashboard({
  overviewPartners,
  directory,
  invites,
  createInviteAction,
  deleteInviteAction,
}: PartnersDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [createForm, setCreateForm] = useState<CreatePartnerForm>(() => ({
    ...DEFAULT_CREATE_FORM,
    notes: [],
  }));
  const [newCreateNoteBody, setNewCreateNoteBody] = useState("");
  const [creatingPartner, setCreatingPartner] = useState(false);
  const [overviewList, setOverviewList] = useState(overviewPartners);
  const [partnerEntries, setPartnerEntries] = useState(directory.partners);

  useEffect(() => {
    setOverviewList(overviewPartners);
  }, [overviewPartners]);

  const csrfToken = useMemo(() => getCsrfToken(), []);
  const partnerOptions = useMemo(
    () =>
      partnerEntries
        .map((entry) => ({
          id: entry.partnerId,
          name: entry.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [partnerEntries]
  );
  const partnerOverviewLookup = useMemo(() => {
    const map = new Map<string, PartnerOverview>();
    overviewList.forEach((partner) => {
      map.set(partner.id, partner);
      map.set(partner.id.toLowerCase(), partner);
    });
    return map;
  }, [overviewList]);
  const standardPartnerOptions = useMemo(
    () =>
      overviewList
        .filter((partner) => partner.type === "standard")
        .map((partner) => ({
          value: partner.id,
          label: partner.display_name ?? partner.id,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [overviewList]
  );
  const { values: listingTierValues } = useGlobalValues("listing_tier", {
    includeInactive: false,
  });
  const listingTierLookup = useMemo(() => {
    const map = new Map<string, string>();
    listingTierValues.forEach((tier) => {
      map.set(tier.key, tier.label);
    });
    return map;
  }, [listingTierValues]);
  const createNoteEntry = useCallback((body: string): PartnerNoteEntry => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    return {
      id,
      body,
      createdAt: new Date().toISOString(),
    };
  }, []);
  const resetCreateForm = useCallback(() => {
    setCreateForm({ ...DEFAULT_CREATE_FORM, notes: [] });
    setNewCreateNoteBody("");
  }, []);

  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);

  const handlePartnerUpdated = useCallback(
    ({ entry, meta }: { entry: PartnerShowcaseEntry; meta: PartnerMeta }) => {
      setPartnerEntries((prev) => {
        const next = prev.filter((item) => item.partnerId !== entry.partnerId);
        next.push(entry);
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setOverviewList((prev) => {
        const existingIndex = prev.findIndex(
          (item) => item.id === meta.partnerId
        );
        const fallback = existingIndex === -1 ? undefined : prev[existingIndex];
        const updatedOverview = mapMetaToOverview(
          meta,
          listingTierLookup,
          fallback
        );
        if (existingIndex === -1) {
          return [updatedOverview, ...prev];
        }
        const next = [...prev];
        next[existingIndex] = updatedOverview;
        return next;
      });
    },
    [listingTierLookup]
  );

  const handleAddCreateNote = useCallback(() => {
    const body = newCreateNoteBody.trim();
    if (!body) return;
    const entry = createNoteEntry(body);
    setCreateForm((prev) => ({
      ...prev,
      notes: [entry, ...prev.notes],
    }));
    setNewCreateNoteBody("");
  }, [newCreateNoteBody, createNoteEntry]);

  const handleRemoveCreateNote = useCallback((noteId: string) => {
    setCreateForm((prev) => ({
      ...prev,
      notes: prev.notes.filter((note) => note.id !== noteId),
    }));
  }, []);

  const syncRouteState = useCallback(
    (nextView: "list" | "create" | "detail", partnerId?: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.delete("view");
      params.delete("partnerId");
      if (nextView === "detail" && partnerId) {
        params.set("view", "detail");
        params.set("partnerId", partnerId);
      } else if (nextView === "create") {
        params.set("view", "create");
      }
      const query = params.toString();
      router.replace(query ? `?${query}` : "?", { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    const paramView = searchParams?.get("view");
    const paramPartnerId = searchParams?.get("partnerId");
    if (paramView === "detail" && paramPartnerId) {
      setActivePartnerId(paramPartnerId);
      setView("detail");
      return;
    }
    if (paramView === "create") {
      setView("create");
      return;
    }
    setView("list");
    setActivePartnerId(null);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [view, activePartnerId]);

  async function handleCreatePartner(event: React.FormEvent) {
    event.preventDefault();
    const displayName = createForm.displayName.trim();
    if (!displayName) {
      toast.error("Display name is required.");
      return;
    }
    if (!createForm.contactEmail.trim()) {
      toast.error("Contact email is required.");
      return;
    }
    if (
      createForm.type !== "standard" &&
      createForm.assignedStandardPartners.length === 0
    ) {
      toast.error(
        "Select at least one standard partner to link transportation and taxi partners."
      );
      return;
    }
    const slugifiedId = createForm.partnerId.trim()
      ? createForm.partnerId.trim()
      : displayName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 80);
    if (!slugifiedId) {
      toast.error(
        "Unable to derive a partner ID. Update the display name and try again."
      );
      return;
    }

    let monthlyFeeValue: number | undefined;
    let discountRateValue: number | undefined;
    let vatRateValue: number | undefined;

    try {
      monthlyFeeValue = parseOptionalNumber(
        createForm.monthlyFee,
        "Monthly fee",
        { min: 0 }
      );
      discountRateValue = parseOptionalNumber(
        createForm.discountRate,
        "Customer discount",
        { min: 0, max: 100 }
      );
      vatRateValue = createForm.vatRegistered
        ? parseOptionalNumber(createForm.vatRate, "VAT rate", {
            min: 0,
            max: 100,
          })
        : undefined;
      if (createForm.vatRegistered && vatRateValue === undefined) {
        throw new Error("Enter a VAT rate when VAT applies.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Check numeric fields."
      );
      return;
    }

    const companyAddress =
      createForm.companyAddressCity.trim() ||
      createForm.companyAddressLine.trim()
        ? {
            city: createForm.companyAddressCity.trim() || undefined,
            addressLine: createForm.companyAddressLine.trim() || undefined,
          }
        : undefined;
    const businessAddress =
      createForm.businessSameAsCompany && companyAddress
        ? { ...companyAddress, sameAsCompany: true }
        : createForm.businessAddressCity.trim() ||
          createForm.businessAddressLine.trim()
        ? {
            city: createForm.businessAddressCity.trim() || undefined,
            addressLine: createForm.businessAddressLine.trim() || undefined,
          }
        : undefined;
    const listingTierKey = createForm.listingTierKey.trim()
      ? createForm.listingTierKey.trim()
      : undefined;

    setCreatingPartner(true);
    try {
      const relationships =
        createForm.type === "standard"
          ? undefined
          : createForm.type === "transport"
          ? { transport: createForm.assignedStandardPartners }
          : { taxi: createForm.assignedStandardPartners };
      const normalizedWebsite = ensureExternalUrl(createForm.website);
      const normalizedGoogleMap = ensureExternalUrl(createForm.googleMapUrl);
      const payload = {
        partnerId: slugifiedId,
        displayName,
        status: createForm.status,
        type: createForm.type,
        contactEmail: createForm.contactEmail.trim(),
        contactName: createForm.contactName.trim() || undefined,
        contactPhone: createForm.contactPhone.trim() || undefined,
        commissionRate: createForm.commissionRate,
        commissionBasis: createForm.commissionBasis,
        companyName: createForm.companyName.trim() || undefined,
        businessName: createForm.businessName.trim() || undefined,
        shortDescription: createForm.shortDescription.trim() || undefined,
        website: normalizedWebsite || undefined,
        googleMapUrl: normalizedGoogleMap || undefined,
        companyIdNumber: createForm.companyIdNumber.trim() || undefined,
        vatRegistered: createForm.vatRegistered,
        vatRate: vatRateValue,
        companyAddress,
        businessAddress:
          createForm.businessSameAsCompany && companyAddress
            ? { ...companyAddress, sameAsCompany: true }
            : businessAddress,
        listingTierKey,
        monthlyFee: monthlyFeeValue,
        discountRate: discountRateValue,
        notes: createForm.notes,
        parentPartners: relationships,
      };
      const response = (await adminApi.partnersCreate(payload, {
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      })) as {
        ok?: boolean;
        item?: PartnerMeta;
      };
      if (!response?.item) {
        throw new Error("Partner creation failed.");
      }
      const createdMeta = response.item;
      const entry = {
        partnerId: createdMeta.partnerId,
        name: createdMeta.displayName ?? createdMeta.partnerId,
        status: createdMeta.status ?? "active",
        categories: [],
        title: null,
        subtitle: null,
        description: null,
        heroImageUrl: createdMeta.media?.heroImageUrl ?? null,
        gallery: [],
        highlights: [],
        isFeatured: false,
        ctaPrimaryLabel: null,
        ctaPrimaryUrl: null,
        ctaSecondaryLabel: null,
        ctaSecondaryUrl: null,
        ageMin: null,
        ageMax: null,
        formUrl: null,
        detailUrl: null,
        selectedFormId: null,
        metadata: {},
        info: createdMeta.info,
        contract: createdMeta.contract,
        ticketing: createdMeta.ticketing,
        ticketDetails: createdMeta.ticketing?.ticketDetails ?? [],
        ticketAddons: createdMeta.ticketing?.addons ?? [],
        media: createdMeta.media,
        bonusProgramEnabled: Boolean(createdMeta.bonusProgramEnabled),
        listingTierKey: createdMeta.listingTierKey ?? null,
      } satisfies PartnerShowcaseEntry;
      setPartnerEntries((prev) =>
        [...prev, entry].sort((a, b) => a.name.localeCompare(b.name))
      );
      setOverviewList((prev) => {
        const nextOverview = mapMetaToOverview(
          createdMeta,
          listingTierLookup,
          undefined
        );
        const next = prev.filter((partner) => partner.id !== nextOverview.id);
        return [nextOverview, ...next];
      });
      setActivePartnerId(entry.partnerId);
      setView("detail");
      syncRouteState("detail", entry.partnerId);
      resetCreateForm();
      toast.success("Partner created.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create partner."
      );
    } finally {
      setCreatingPartner(false);
    }
  }

  if (view === "detail" && activePartnerId) {
    return (
      <PartnerDetailEditor
        directory={directory}
        partnerEntries={partnerEntries}
        activePartnerId={activePartnerId}
        standardPartnerOptions={standardPartnerOptions}
        onBack={() => {
          setView("list");
          setActivePartnerId(null);
          syncRouteState("list");
        }}
        onPartnerUpdated={handlePartnerUpdated}
      />
    );
  }

  if (view === "create") {
    return (
      <div className="space-y-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setView("list");
            resetCreateForm();
            syncRouteState("list");
          }}
        >
          ← Back to partners
        </Button>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Create partner</CardTitle>
            <CardDescription>
              Set the basic information. You can configure details after
              creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleCreatePartner}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Display name</Label>
                  <Input
                    value={createForm.displayName}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        displayName: event.target.value,
                      }))
                    }
                    placeholder="Partner display name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    value={createForm.status}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        status: event.target
                          .value as CreatePartnerForm["status"],
                      }))
                    }
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Partner type</Label>
                  <select
                    value={createForm.type}
                    onChange={(event) => {
                      const nextType = event.target
                        .value as CreatePartnerForm["type"];
                      setCreateForm((prev) => ({
                        ...prev,
                        type: nextType,
                        assignedStandardPartners:
                          nextType === "standard"
                            ? []
                            : prev.assignedStandardPartners,
                      }));
                    }}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="standard">Standard partner</option>
                    <option value="transport">Transportation partner</option>
                    <option value="taxi">Taxi partner</option>
                  </select>
                  <p className="text-xs text-slate-500">
                    Transportation and taxi partners can be linked to standard
                    partners for booking flows.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Listing tier</Label>
                  <select
                    value={createForm.listingTierKey}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        listingTierKey: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">No tier</option>
                    {listingTierValues.map((tier) => (
                      <option key={tier.id} value={tier.key}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    Silver partners surface in the top 20, Gold in the top 10,
                    and Platinum in the top 5.
                  </p>
                </div>
              </div>

              {createForm.type !== "standard" ? (
                <div className="space-y-2">
                  <Label>
                    Linked standard partners
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      Select at least one primary partner.
                    </span>
                  </Label>
                  <MultiSelect
                    options={standardPartnerOptions}
                    value={createForm.assignedStandardPartners}
                    onChange={(value) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        assignedStandardPartners: value,
                      }))
                    }
                    placeholder="Create a standard partner first to link transport or taxi partners."
                  />
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Contact name</Label>
                  <Input
                    value={createForm.contactName}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        contactName: event.target.value,
                      }))
                    }
                    placeholder="Primary contact person"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact email</Label>
                  <Input
                    value={createForm.contactEmail}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        contactEmail: event.target.value,
                      }))
                    }
                    type="email"
                    required
                    placeholder="team@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact phone</Label>
                  <Input
                    value={createForm.contactPhone}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        contactPhone: event.target.value,
                      }))
                    }
                    placeholder="+420 123 456 789"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Company name</Label>
                  <Input
                    value={createForm.companyName}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        companyName: event.target.value,
                      }))
                    }
                    placeholder="Legal company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business / attraction name</Label>
                  <Input
                    value={createForm.businessName}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        businessName: event.target.value,
                      }))
                    }
                    placeholder="Customer-facing experience"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Short description</Label>
                <Textarea
                  value={createForm.shortDescription}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      shortDescription: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="1–2 sentences for internal context"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    value={createForm.website}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        website: event.target.value,
                      }))
                    }
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Google Maps link</Label>
                  <Input
                    value={createForm.googleMapUrl}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        googleMapUrl: event.target.value,
                      }))
                    }
                    placeholder="https://maps.google.com/..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Company ID number</Label>
                <Input
                  value={createForm.companyIdNumber}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      companyIdNumber: event.target.value,
                    }))
                  }
                  placeholder="Identifikační číslo (IČO)"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Company address</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      value={createForm.companyAddressCity}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          companyAddressCity: event.target.value,
                          businessAddressCity: prev.businessSameAsCompany
                            ? event.target.value
                            : prev.businessAddressCity,
                        }))
                      }
                      placeholder="City"
                    />
                    <Input
                      value={createForm.companyAddressLine}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          companyAddressLine: event.target.value,
                          businessAddressLine: prev.businessSameAsCompany
                            ? event.target.value
                            : prev.businessAddressLine,
                        }))
                      }
                      placeholder="Street / full address"
                    />
                  </div>
                </div>
                <div className="space-y-3 rounded-lg border border-slate-200/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label>Business address</Label>
                      <p className="text-xs text-slate-500">
                        Where customers arrive.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Same as company</span>
                      <Switch
                        checked={createForm.businessSameAsCompany}
                        onCheckedChange={(checked) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            businessSameAsCompany: checked,
                            businessAddressCity: checked
                              ? prev.companyAddressCity
                              : prev.businessAddressCity,
                            businessAddressLine: checked
                              ? prev.companyAddressLine
                              : prev.businessAddressLine,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      value={createForm.businessAddressCity}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          businessAddressCity: event.target.value,
                        }))
                      }
                      placeholder="City"
                      disabled={createForm.businessSameAsCompany}
                    />
                    <Input
                      value={createForm.businessAddressLine}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          businessAddressLine: event.target.value,
                        }))
                      }
                      placeholder="Street / full address"
                      disabled={createForm.businessSameAsCompany}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-slate-200/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>VAT applies?</Label>
                    <p className="text-xs text-slate-500">
                      Toggle if invoices should include VAT.
                    </p>
                  </div>
                  <Switch
                    checked={createForm.vatRegistered}
                    onCheckedChange={(checked) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        vatRegistered: checked,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>VAT rate (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={createForm.vatRate}
                      disabled={!createForm.vatRegistered}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          vatRate: event.target.value,
                        }))
                      }
                      placeholder="21"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-slate-200/80 p-4">
                <div className="space-y-2">
                  <Label>Commission rate</Label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={createForm.commissionRate}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          commissionRate: Number(event.target.value),
                        }))
                      }
                      className="flex-1 accent-emerald-500"
                    />
                    <span className="w-16 text-sm text-slate-700">
                      {createForm.commissionRate}%
                    </span>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Commission basis</Label>
                    <select
                      value={createForm.commissionBasis}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          commissionBasis: event.target
                            .value as CreatePartnerForm["commissionBasis"],
                        }))
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="discounted">Discounted price</option>
                      <option value="original">Original price</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly fee (CZK)</Label>
                    <Input
                      value={createForm.monthlyFee}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          monthlyFee: event.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Discount (%)</Label>
                    <Input
                      value={createForm.discountRate}
                      onChange={(event) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          discountRate: event.target.value,
                        }))
                      }
                      placeholder="e.g. 15"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pricing guidance</Label>
                    <p className="text-sm text-muted-foreground">
                      Ticket-level prices and add-ons are configured after the
                      partner is created inside the detail editor.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200/80 p-4">
                <div className="space-y-2">
                  <Label>Internal notes</Label>
                  <Textarea
                    value={newCreateNoteBody}
                    onChange={(event) =>
                      setNewCreateNoteBody(event.target.value)
                    }
                    rows={3}
                    placeholder="Add a note for other admins"
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddCreateNote}
                      disabled={!newCreateNoteBody.trim()}
                    >
                      Add note
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Notes save when you create the partner.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {createForm.notes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No notes yet.
                    </p>
                  ) : (
                    createForm.notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-2xl border border-slate-200/70 bg-slate-50 p-3 text-sm text-slate-700"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="whitespace-pre-line">{note.body}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {new Date(note.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveCreateNote(note.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={creatingPartner}>
                  {creatingPartner ? "Creating…" : "Create partner"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => resetCreateForm()}
                >
                  Clear
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PartnersTable
        partners={overviewList}
        actions={
        <Button
          type="button"
          onClick={() => {
            resetCreateForm();
            setView("create");
            syncRouteState("create");
          }}
        >
          Create partner
        </Button>
      }
        onPartnerClick={(partner) => {
          setActivePartnerId(partner.id);
          setView("detail");
          syncRouteState("detail", partner.id);
        }}
      />

      <Separator />

      <div className="space-y-6">
        <PartnerInviteForm
          action={createInviteAction}
          partners={partnerOptions}
        />
        <PartnerInviteTable
          invites={invites}
          deleteAction={deleteInviteAction}
          partnerLookup={partnerOverviewLookup}
        />
      </div>
    </div>
  );
}
