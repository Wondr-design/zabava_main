"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminApi } from "@/lib/web/api-client";
import { formatCurrencyCZK } from "@/lib/format/currency";
import { useGlobalValues } from "@/hooks/use-global-values";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PartnerInviteFormProps {
  action: (
    prevState: PartnerInviteFormState,
    formData: FormData
  ) => Promise<PartnerInviteFormState>;
  partners?: Array<{ id: string; name: string }>;
}

export interface PartnerInviteFormState {
  success?: boolean;
  error?: string;
}

const initialState: PartnerInviteFormState = {};

const DEFAULT_FORM_VALUES = {
  partnerId: "",
  email: "",
  role: "partner",
  name: "",
  expiresInMinutes: String(60 * 24),
};

const MANUAL_PARTNER_VALUE = "__manual__";

interface PartnerSnapshot {
  id: string;
  name: string;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  listingTierLabel: string | null;
  monthlyFee: number | null;
  commissionRate: number | null;
  commissionBasis: "original" | "discounted";
}

export function PartnerInviteForm({
  action,
  partners = [],
}: PartnerInviteFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [formValues, setFormValues] = useState(DEFAULT_FORM_VALUES);
  const [loadingPartner, setLoadingPartner] = useState(false);
  const [partnerSnapshot, setPartnerSnapshot] = useState<PartnerSnapshot | null>(
    null,
  );
  const { values: listingTierValues } = useGlobalValues("listing_tier", {
    includeInactive: true,
  });

  const sortedPartners = useMemo(() => {
    return [...partners].sort((a, b) => a.name.localeCompare(b.name));
  }, [partners]);

  const listingTierLookup = useMemo(() => {
    const map = new Map<string, string>();
    listingTierValues.forEach((tier) => {
      map.set(tier.key, tier.label);
    });
    return map;
  }, [listingTierValues]);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setFormValues(DEFAULT_FORM_VALUES);
    }
  }, [state.success]);

function updateFormValue(key: keyof typeof DEFAULT_FORM_VALUES, value: string) {
  setFormValues((prev) => ({
    ...prev,
    [key]: value,
  }));
}

function SubmitInviteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Creating…
        </span>
      ) : (
        "Create invite"
      )}
    </Button>
  );
}

  async function handlePartnerSelect(value: string) {
    if (value === MANUAL_PARTNER_VALUE) {
      setFormValues((prev) => ({
        ...prev,
        partnerId: "",
        email: "",
        name: "",
      }));
      setPartnerSnapshot(null);
      return;
    }
    updateFormValue("partnerId", value);
    setLoadingPartner(true);
    try {
      const response = (await adminApi.partnerGet(value, {})) as {
        item?: {
          partnerId: string;
          displayName?: string | null;
          listingTierKey?: string | null;
          contract?: {
            monthlyFee?: number | null;
            commissionRate?: number | null;
            commissionBasis?: "original" | "discounted";
          } | null;
          info?: {
            contactEmail?: string | null;
            contactName?: string | null;
            contactPhone?: string | null;
          } | null;
        } | null;
      };
      const info = response?.item?.info ?? {};
      const contract = response?.item?.contract ?? {};
      const contactEmail = info.contactEmail?.trim().toLowerCase() ?? "";
      const listingTierLabel = response?.item?.listingTierKey
        ? listingTierLookup.get(response.item.listingTierKey) ??
          response.item.listingTierKey
        : null;
      const contactName = info.contactName?.trim() ?? "";
      setPartnerSnapshot({
        id: response?.item?.partnerId ?? value,
        name: response?.item?.displayName ?? value,
        contactEmail: info.contactEmail ?? "",
        contactName,
        contactPhone: info.contactPhone ?? "",
        listingTierLabel,
        monthlyFee:
          typeof contract.monthlyFee === "number" ? contract.monthlyFee : null,
        commissionRate:
          typeof contract.commissionRate === "number"
            ? contract.commissionRate
            : null,
        commissionBasis:
          contract.commissionBasis === "original" ? "original" : "discounted",
      });
      setFormValues((prev) => ({
        ...prev,
        partnerId: value,
        email: contactEmail || "",
        name: prev.name.trim().length > 0 ? prev.name : contactName,
      }));
    } catch (error) {
      console.error("partner invite fetch partner error", error);
      toast.error(
        "Unable to load partner details. You can fill the email manually.",
      );
      setPartnerSnapshot(null);
    } finally {
      setLoadingPartner(false);
    }
  }

  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-slate-900">
          Create invite
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Generate a new partner or admin invite.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          action={formAction}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="invite-partner-select">Partner</Label>
            <Select
              value={formValues.partnerId || MANUAL_PARTNER_VALUE}
              onValueChange={handlePartnerSelect}
            >
              <SelectTrigger id="invite-partner-select">
                <SelectValue placeholder="Select partner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MANUAL_PARTNER_VALUE}>
                  Manual entry
                </SelectItem>
                {sortedPartners.map((partner) => (
                  <SelectItem key={partner.id} value={partner.id}>
                    {partner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loadingPartner ? (
              <p className="text-xs text-slate-500">
                Loading partner contact…
              </p>
            ) : null}
            {partnerSnapshot ? (
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                  Summary
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Listing tier</p>
                    <p className="font-semibold">
                      {partnerSnapshot.listingTierLabel ?? "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Monthly fee</p>
                    <p className="font-semibold">
                      {partnerSnapshot.monthlyFee !== null
                        ? formatCurrencyCZK(partnerSnapshot.monthlyFee)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Contact name</p>
                    <p className="font-semibold">
                      {partnerSnapshot.contactName || "Not set"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {partnerSnapshot.contactEmail || "No email"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {partnerSnapshot.contactPhone || "No phone"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Commission</p>
                    <p className="font-semibold">
                      {partnerSnapshot.commissionRate ?? "—"}% ·{
                        " "
                      }
                      {partnerSnapshot.commissionBasis === "original"
                        ? "Original price"
                        : "Discounted price"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              placeholder="user@example.com"
              required
              value={formValues.email}
              onChange={(event) =>
                updateFormValue("email", event.target.value)
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-partner">Partner ID</Label>
            <Input
              id="invite-partner"
              name="partnerId"
              placeholder="demo-partner"
              required
              value={formValues.partnerId}
              onChange={(event) =>
                updateFormValue("partnerId", event.target.value)
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              name="role"
              value={formValues.role}
              onValueChange={(value) => updateFormValue("role", value)}
            >
              <SelectTrigger id="invite-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="partner">Partner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-name">Name (optional)</Label>
            <Input
              id="invite-name"
              name="name"
              placeholder="Full name"
              value={formValues.name}
              onChange={(event) =>
                updateFormValue("name", event.target.value)
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invite-expiry">Expiry (minutes)</Label>
            <Input
              id="invite-expiry"
              name="expiresInMinutes"
              type="number"
              min={60}
              step={60}
              value={formValues.expiresInMinutes}
              onChange={(event) =>
                updateFormValue("expiresInMinutes", event.target.value)
              }
            />
          </div>
          <div className="flex items-end">
            <SubmitInviteButton />
          </div>
        </form>
        {state.error ? (
          <p className="mt-4 text-sm text-red-600">{state.error}</p>
        ) : null}
        {state.success ? (
          <p className="mt-4 text-sm text-emerald-600">
            Invite created successfully.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
