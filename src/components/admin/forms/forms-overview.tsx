"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import type { PartnerFormRecord } from "@/lib/data/partner-forms";
import type { RewardRecord } from "@/lib/data/rewards";
import { adminApi } from "@/lib/web/api-client";
import { getCsrfToken } from "@/lib/web/csrf";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/ui/localized-link";
import { useLocalizedRouter } from "@/i18n/use-localized-router";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

type PartnerOption = {
  id: string;
  displayName: string | null;
  type?: "standard" | "transport";
};

const STATUS_LABELS: Record<PartnerFormRecord["status"], string> = {
  draft: "Saved",
  published: "Live",
  archived: "Archived",
};

const STATUS_BADGE_CLASS: Record<PartnerFormRecord["status"], string> = {
  draft: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  archived: "border-border bg-muted text-muted-foreground",
};

const USAGE_LABELS: Record<PartnerFormRecord["usageType"], string> = {
  visit: "Visit",
  reward: "Reward",
  deal: "Deal",
};

const USAGE_BADGE_CLASS: Record<PartnerFormRecord["usageType"], string> = {
  visit: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  reward: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  deal: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

type DealOption = {
  id: string;
  title: string;
  partnerName: string | null;
  status: string;
  slug: string | null;
  minVisitors: number | null;
};

interface AdminFormsOverviewProps {
  forms: PartnerFormRecord[];
  partners: PartnerOption[];
  rewards: RewardRecord[];
  deals: DealOption[];
}

type FormFilterType = "all" | "visit" | "reward" | "deal";

export function AdminFormsOverview({
  forms: initialForms,
  partners,
  rewards,
  deals,
}: AdminFormsOverviewProps) {
  const router = useLocalizedRouter();
  const [forms, setForms] = useState(initialForms);
  const [creating, setCreating] = useState(false);
  const [newPartnerId, setNewPartnerId] = useState<string>(
    partners[0]?.id ?? ""
  );
  const [newFormName, setNewFormName] = useState("");
  const [newFormType, setNewFormType] = useState<PartnerFormRecord["usageType"]>("visit");
  const [newRewardId, setNewRewardId] = useState<string>("");
  const [newDealId, setNewDealId] = useState<string>("");
  const [filterType, setFilterType] = useState<FormFilterType>("all");

  const partnerLookup = useMemo(() => {
    const map = new Map<string, string>();
    partners.forEach((partner) => {
      if (partner.id) {
        map.set(
          partner.id,
          partner.displayName?.trim() || partner.id || "—"
        );
      }
    });
    return map;
  }, [partners]);

  // Calculate counts for each form type
  const formCounts = useMemo(() => {
    const counts = {
      all: forms.length,
      visit: forms.filter((f) => f.usageType === "visit").length,
      reward: forms.filter((f) => f.usageType === "reward").length,
      deal: forms.filter((f) => f.usageType === "deal").length,
    };
    return counts;
  }, [forms]);

  // Filter forms based on selected type
  const filteredForms = useMemo(() => {
    if (filterType === "all") {
      return forms;
    }
    return forms.filter((form) => form.usageType === filterType);
  }, [forms, filterType]);

  const sortedForms = useMemo(() => {
    return [...filteredForms].sort((a, b) => {
      return (
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  }, [filteredForms]);

  const rewardOptions = useMemo(() => {
    return rewards
      .map((reward) => ({
        value: reward.id,
        label: reward.name,
        status: reward.status,
        pointsCost: reward.pointsCost,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rewards]);

  const dealOptionsList = useMemo(() => {
    return deals
      .filter((deal) => Boolean(deal.slug))
      .map((deal) => ({
        value: deal.id,
        label: deal.partnerName
          ? `${deal.title} · ${deal.partnerName}`
          : deal.title,
        status: deal.status,
        slug: deal.slug,
        minVisitors: deal.minVisitors,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [deals]);

  const handleCreate = async () => {
    if (!newPartnerId) {
      toast.error("Select a partner before creating a form.");
      return;
    }
    if (!newFormType) {
      toast.error("Select a form type before creating a form.");
      return;
    }
    if (newFormType === "reward" && !newRewardId) {
      toast.error("Select a reward for reward forms.");
      return;
    }
    if (newFormType === "deal" && !newDealId) {
      toast.error("Select a deal for deal forms.");
      return;
    }
    if (!newFormName.trim()) {
      toast.error("Enter a name for the new form.");
      return;
    }
    setCreating(true);
    try {
      const payload: {
        partnerId: string;
        name: string;
        usageType: PartnerFormRecord["usageType"];
        rewardId?: string;
        dealId?: string;
      } = {
        partnerId: newPartnerId.trim(),
        name: newFormName.trim(),
        usageType: newFormType,
      };
      if (newFormType === "reward" && newRewardId) {
        payload.rewardId = newRewardId;
      }
      if (newFormType === "deal" && newDealId) {
        payload.dealId = newDealId;
      }
      const response = await adminApi.formCreate(payload, {
        headers: { "x-csrf-token": getCsrfToken() },
      });
      const created = response.item as PartnerFormRecord;
      setForms((prev) => [created, ...prev]);
      toast.success("Partner form created.");
      setNewFormName("");
      setNewFormType("visit");
      setNewRewardId("");
      setNewDealId("");
      router.push(`/admin/forms/${created.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create form."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>Create new form</CardTitle>
          <CardDescription>
            Choose a partner and form type, give the configuration a name, and jump into the
            builder to customise steps and fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label className="text-xs uppercase text-muted-foreground">
                Partner <span className="text-red-500">*</span>
              </Label>
              <Select
                value={newPartnerId}
                onValueChange={(value) => setNewPartnerId(value)}
              >
                <SelectTrigger className="w-full border-border bg-muted/50">
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.displayName ?? partner.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground">
                Form type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={newFormType}
                onValueChange={(value) => {
                  setNewFormType(value as PartnerFormRecord["usageType"]);
                  setNewRewardId("");
                  setNewDealId("");
                }}
              >
                <SelectTrigger className="w-full border-border bg-muted/50">
                  <SelectValue placeholder="Select form type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visit">Standard visit form</SelectItem>
                  <SelectItem value="reward">Reward redemption form</SelectItem>
                  <SelectItem value="deal">Flash deal form</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground">
                Form name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={newFormName}
                onChange={(event) => setNewFormName(event.target.value)}
                placeholder="Olomouc Science Museum"
              />
            </div>
          </div>
          {newFormType === "reward" && (
            <div>
              <Label className="text-xs uppercase text-muted-foreground">
                Linked reward <span className="text-red-500">*</span>
              </Label>
              {rewardOptions.length > 0 ? (
                <Select
                  value={newRewardId}
                  onValueChange={(value) => setNewRewardId(value)}
                >
                  <SelectTrigger className="w-full border-border bg-muted/50">
                    <SelectValue placeholder="Select reward" />
                  </SelectTrigger>
                  <SelectContent>
                    {rewardOptions.map((reward) => (
                      <SelectItem key={reward.value} value={reward.value}>
                        {reward.label} · {reward.pointsCost} pts
                        {reward.status !== "active" ? " (inactive)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                  No rewards found. Create a reward first.
                </div>
              )}
            </div>
          )}
          {newFormType === "deal" && (
            <div>
              <Label className="text-xs uppercase text-muted-foreground">
                Linked deal <span className="text-red-500">*</span>
              </Label>
              {dealOptionsList.length > 0 ? (
                <Select
                  value={newDealId}
                  onValueChange={(value) => setNewDealId(value)}
                >
                  <SelectTrigger className="w-full border-border bg-muted/50">
                    <SelectValue placeholder="Select deal" />
                  </SelectTrigger>
                  <SelectContent>
                    {dealOptionsList.map((deal) => (
                      <SelectItem key={deal.value} value={deal.value}>
                        {deal.label}
                        {deal.minVisitors ? ` · min ${deal.minVisitors}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                  No eligible deals found. Publish a flash deal first.
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleCreate}
              disabled={
                creating ||
                !newPartnerId ||
                !newFormType ||
                !newFormName.trim() ||
                (newFormType === "reward" && !newRewardId) ||
                (newFormType === "deal" && !newDealId)
              }
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create & customise
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Existing forms</CardTitle>
              <CardDescription>
                Review all partner forms. Click a row to continue editing or grab
                the embed code.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={filterType} onValueChange={(value) => setFilterType(value as FormFilterType)} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="all" className="relative">
                All
                {formCounts.all > 0 && (
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {formCounts.all}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="visit" className="relative">
                Visit
                {formCounts.visit > 0 && (
                  <span className="ml-2 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                    {formCounts.visit}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="reward" className="relative">
                Reward
                {formCounts.reward > 0 && (
                  <span className="ml-2 rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
                    {formCounts.reward}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="deal" className="relative">
                Flash Deal
                {formCounts.deal > 0 && (
                  <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                    {formCounts.deal}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6 space-y-4">
              {sortedForms.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  No forms yet. Create one above to get started.
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Form</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedForms.map((form) => (
                        <TableRow key={form.id}>
                          <TableCell className="font-medium">{form.name}</TableCell>
                          <TableCell>
                            {form.partnerId
                              ? partnerLookup.get(form.partnerId) ?? form.partnerId
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "border px-2.5 py-1 text-xs font-medium",
                                USAGE_BADGE_CLASS[form.usageType] ??
                                  "border-border bg-muted text-muted-foreground"
                              )}
                            >
                              {USAGE_LABELS[form.usageType] ?? form.usageType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "border px-2.5 py-1 text-xs font-medium",
                                STATUS_BADGE_CLASS[form.status]
                              )}
                            >
                              {STATUS_LABELS[form.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(form.updatedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm">
                              <LocalizedLink href={`/admin/forms/${form.id}`}>
                                Edit
                                <ArrowRight className="ml-2 h-3 w-3" />
                              </LocalizedLink>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            <TabsContent value="visit" className="mt-6 space-y-4">
              {sortedForms.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  No visit forms found.
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Form</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedForms.map((form) => (
                        <TableRow key={form.id}>
                          <TableCell className="font-medium">{form.name}</TableCell>
                          <TableCell>
                            {form.partnerId
                              ? partnerLookup.get(form.partnerId) ?? form.partnerId
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "border px-2.5 py-1 text-xs font-medium",
                                STATUS_BADGE_CLASS[form.status]
                              )}
                            >
                              {STATUS_LABELS[form.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(form.updatedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm">
                              <LocalizedLink href={`/admin/forms/${form.id}`}>
                                Edit
                                <ArrowRight className="ml-2 h-3 w-3" />
                              </LocalizedLink>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            <TabsContent value="reward" className="mt-6 space-y-4">
              {sortedForms.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  No reward forms found.
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Form</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedForms.map((form) => (
                        <TableRow key={form.id}>
                          <TableCell className="font-medium">{form.name}</TableCell>
                          <TableCell>
                            {form.partnerId
                              ? partnerLookup.get(form.partnerId) ?? form.partnerId
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "border px-2.5 py-1 text-xs font-medium",
                                STATUS_BADGE_CLASS[form.status]
                              )}
                            >
                              {STATUS_LABELS[form.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(form.updatedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm">
                              <LocalizedLink href={`/admin/forms/${form.id}`}>
                                Edit
                                <ArrowRight className="ml-2 h-3 w-3" />
                              </LocalizedLink>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
            <TabsContent value="deal" className="mt-6 space-y-4">
              {sortedForms.length === 0 ? (
                <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  No flash deal forms found.
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Form</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedForms.map((form) => (
                        <TableRow key={form.id}>
                          <TableCell className="font-medium">{form.name}</TableCell>
                          <TableCell>
                            {form.partnerId
                              ? partnerLookup.get(form.partnerId) ?? form.partnerId
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "border px-2.5 py-1 text-xs font-medium",
                                STATUS_BADGE_CLASS[form.status]
                              )}
                            >
                              {STATUS_LABELS[form.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(form.updatedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="outline" size="sm">
                              <LocalizedLink href={`/admin/forms/${form.id}`}>
                                Edit
                                <ArrowRight className="ml-2 h-3 w-3" />
                              </LocalizedLink>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
