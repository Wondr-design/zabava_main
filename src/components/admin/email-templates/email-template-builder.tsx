"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import type { EmailTemplateRecord } from "@/lib/data/email-templates";
import { getCsrfToken } from "@/lib/web/csrf";
import { cn } from "@/lib/utils";
import {
  EMAIL_TEMPLATE_DEFAULTS,
  EmailTemplateType,
  emailTemplateTypes,
} from "@/lib/email-template-constants";
import type {
  EmailTemplateElement,
  EmailTemplateStructure,
  EmailTemplateElementType,
} from "@/lib/types/email-template-structure";
import {
  AVAILABLE_ELEMENTS_BY_TYPE,
  emailTemplateElementTypes,
  getDefaultStructure,
} from "@/lib/types/email-template-structure";
import {
  EmailTemplatePreviewPanel,
  TemplatePreviewFixture,
  buildPreviewFixture,
} from "./email-template-preview";

const TEMPLATE_METADATA: Record<
  EmailTemplateType,
  {
    title: string;
    subtitle: string;
    category: "Transactional" | "Security" | "Onboarding";
    usage: string[];
  }
> = {
  qr_delivery: {
    title: "QR delivery",
    subtitle: "Sent whenever we issue a QR (visits, rewards, flash deals).",
    category: "Transactional",
    usage: [
      "New QR for visits",
      "Reward redemption approvals",
      "Flash deal QR generation",
    ],
  },
  visit_confirmed: {
    title: "Visit confirmed",
    subtitle: "Sent after staff confirms a check-in in the dashboard.",
    category: "Transactional",
    usage: ["Staff marks a visit as completed"],
  },
  visit_updated: {
    title: "Visit updated",
    subtitle: "Sent when staff edits visitor details after booking.",
    category: "Transactional",
    usage: ["Staff edits guests, quantities, or schedule"],
  },
  invite_partner: {
    title: "Partner invite",
    subtitle: "Invites venue admins into Zabava.",
    category: "Onboarding",
    usage: ["Admin sends a partner onboarding invite"],
  },
  invite_staff: {
    title: "Staff invite",
    subtitle: "Invites venue staff members to manage visits.",
    category: "Onboarding",
    usage: ["Partner admin shares an invite link with staff"],
  },
  verification_code: {
    title: "Verification code",
    subtitle: "Two-factor codes for admin/staff/partner logins and flows.",
    category: "Security",
    usage: [
      "Admin/staff/partner login",
      "Deal QR generator",
      "Bonus portal verification",
    ],
  },
  billing_report: {
    title: "Billing report",
    subtitle: "Monthly billing exports with CSV / XLSX attachments.",
    category: "Transactional",
    usage: ["Monthly billing digest"],
  },
};

function isEmailTemplateElementType(
  value: string,
): value is EmailTemplateElementType {
  return emailTemplateElementTypes.includes(
    value as EmailTemplateElementType,
  );
}

function cloneTemplates(records: EmailTemplateRecord[]) {
  return records.map((record) => ({
    ...record,
    structure: record.structure
      ? (JSON.parse(JSON.stringify(record.structure)) as EmailTemplateStructure)
      : record.structure ?? null,
  }));
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return "Never saved";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never saved";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function EmailTemplateBuilder({
  initialTemplates,
  locale,
}: {
  initialTemplates: EmailTemplateRecord[];
  locale: string;
}) {
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>(() =>
    cloneTemplates(initialTemplates),
  );
  const [baselineTemplates, setBaselineTemplates] = useState<
    EmailTemplateRecord[]
  >(() => cloneTemplates(initialTemplates));
  const [saving, setSaving] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | null>(() => getCsrfToken());
  const [activeTab, setActiveTab] = useState<EmailTemplateType>(
    emailTemplateTypes[0],
  );

  useEffect(() => {
    setTemplates(cloneTemplates(initialTemplates));
    setBaselineTemplates(cloneTemplates(initialTemplates));
  }, [initialTemplates]);

  const mergedTemplates = useMemo(() => {
    return emailTemplateTypes.map((type) => {
      const existing = templates.find(
        (template) =>
          template.templateType === type && template.locale === locale,
      );
      if (existing) {
        return existing.structure
          ? existing
          : {
              ...existing,
              structure: getDefaultStructure(type),
            };
      }
      const defaults = EMAIL_TEMPLATE_DEFAULTS[type];
      return {
        templateType: type,
        locale,
        subject: defaults.subject,
        body: defaults.body,
        description: defaults.description,
        structure: getDefaultStructure(type),
      } satisfies EmailTemplateRecord;
    });
  }, [templates, locale]);

  const currentTemplate = useMemo(() => {
    return (
      mergedTemplates.find((template) => template.templateType === activeTab) ??
      mergedTemplates[0]
    );
  }, [mergedTemplates, activeTab]);

  const availableElements = useMemo(() => {
    return AVAILABLE_ELEMENTS_BY_TYPE[currentTemplate.templateType] || [];
  }, [currentTemplate.templateType]);

  const dirty = useMemo(() => {
    const baselineMap = new Map(
      baselineTemplates.map((template) => [
        template.templateType,
        template,
      ]),
    );

    return mergedTemplates.some((template) => {
      const baseline = baselineMap.get(template.templateType);
      if (!baseline) return true;
      if (
        baseline.subject !== template.subject ||
        baseline.body !== template.body ||
        (baseline.description ?? null) !== (template.description ?? null)
      ) {
        return true;
      }
      const left = JSON.stringify(baseline.structure ?? null);
      const right = JSON.stringify(template.structure ?? null);
      return left !== right;
    });
  }, [baselineTemplates, mergedTemplates]);

  const updateTemplate = useCallback(
    (type: EmailTemplateType, updates: Partial<EmailTemplateRecord>) => {
      setTemplates((prev) => {
        const exists = prev.some(
          (record) => record.templateType === type && record.locale === locale,
        );
        if (!exists) {
          const defaults = EMAIL_TEMPLATE_DEFAULTS[type];
          return [
            ...prev,
            {
              templateType: type,
              locale,
              subject: updates.subject ?? defaults.subject,
              body: updates.body ?? defaults.body,
              description: updates.description ?? defaults.description,
              structure: updates.structure ?? getDefaultStructure(type),
            },
          ];
        }
        return prev.map((record) =>
          record.templateType === type && record.locale === locale
            ? { ...record, ...updates }
            : record,
        );
      });
    },
    [locale],
  );

  const updateTemplateStructure = useCallback(
    (type: EmailTemplateType, structure: EmailTemplateStructure) => {
      updateTemplate(type, { structure });
    },
    [updateTemplate],
  );

  const updateBody = useCallback(
    (type: EmailTemplateType, body: string) => {
      updateTemplate(type, { body });
    },
    [updateTemplate],
  );

  const updateSubject = useCallback(
    (type: EmailTemplateType, subject: string) => {
      updateTemplate(type, { subject });
    },
    [updateTemplate],
  );

  const updateDescription = useCallback(
    (type: EmailTemplateType, description: string) => {
      updateTemplate(type, { description });
    },
    [updateTemplate],
  );

  const reorderElements = useCallback(
    (type: EmailTemplateType, fromIndex: number, toIndex: number) => {
      const template = mergedTemplates.find((t) => t.templateType === type);
      if (!template?.structure) return;
      const nextElements = [...template.structure.elements];
      const [moved] = nextElements.splice(fromIndex, 1);
      nextElements.splice(toIndex, 0, moved);
      updateTemplateStructure(type, { elements: nextElements });
    },
    [mergedTemplates, updateTemplateStructure],
  );

  const toggleElementVisibility = useCallback(
    (type: EmailTemplateType, elementIndex: number) => {
      const template = mergedTemplates.find((t) => t.templateType === type);
      if (!template?.structure) return;
      const nextElements = [...template.structure.elements];
      nextElements[elementIndex] = {
        ...nextElements[elementIndex],
        visible: !nextElements[elementIndex].visible,
      };
      updateTemplateStructure(type, { elements: nextElements });
    },
    [mergedTemplates, updateTemplateStructure],
  );

  const updateElement = useCallback(
    (
      type: EmailTemplateType,
      elementIndex: number,
      updates: Partial<EmailTemplateElement>,
    ) => {
      const template = mergedTemplates.find((t) => t.templateType === type);
      if (!template?.structure) return;
      const nextElements = [...template.structure.elements];
      nextElements[elementIndex] = {
        ...nextElements[elementIndex],
        ...updates,
      } as EmailTemplateElement;
      updateTemplateStructure(type, { elements: nextElements });
    },
    [mergedTemplates, updateTemplateStructure],
  );

  const addElement = useCallback(
    (type: EmailTemplateType, elementType: EmailTemplateElementType) => {
      const template = mergedTemplates.find((t) => t.templateType === type);
      if (!template?.structure) return;
      const allowed = AVAILABLE_ELEMENTS_BY_TYPE[type] || [];
      if (!allowed.includes(elementType)) return;
      const next: EmailTemplateElement = (() => {
        switch (elementType) {
          case "greeting":
            return { type: "greeting", visible: true };
          case "body_text":
            return { type: "body_text", visible: true, content: "" };
          case "qr_code":
            return { type: "qr_code", visible: true };
          case "details_table":
            return { type: "details_table", visible: true };
          case "footer":
            return { type: "footer", visible: true };
          case "verification_code":
            return { type: "verification_code", visible: true, format: "plain" };
          case "invite_link":
            return { type: "invite_link", visible: true, buttonStyle: true };
          case "action_button":
            return { type: "action_button", visible: true };
          default:
            return { type: "greeting", visible: true };
        }
      })();
      updateTemplateStructure(type, {
        elements: [...template.structure.elements, next],
      });
    },
    [mergedTemplates, updateTemplateStructure],
  );

  const removeElement = useCallback(
    (type: EmailTemplateType, elementIndex: number) => {
      const template = mergedTemplates.find((t) => t.templateType === type);
      if (!template?.structure) return;
      const nextElements = template.structure.elements.filter(
        (_, index) => index !== elementIndex,
      );
      updateTemplateStructure(type, { elements: nextElements });
    },
    [mergedTemplates, updateTemplateStructure],
  );

  async function handleSave() {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        body: JSON.stringify({ templates: mergedTemplates }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(
          json?.error || json?.message || "Failed to save templates.",
        );
      }
      const nextToken = res.headers.get("x-csrf-token");
      if (nextToken) {
        setCsrfToken(nextToken);
      }
      setBaselineTemplates(cloneTemplates(mergedTemplates));
      toast.success("Templates saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save templates.",
      );
    } finally {
      setSaving(false);
    }
  }

  const previewFixture: TemplatePreviewFixture | undefined = useMemo(
    () => buildPreviewFixture(currentTemplate.templateType),
    [currentTemplate.templateType],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Email templates
          </p>
          <h1 className="text-2xl font-semibold leading-tight text-foreground">
            System email studio
          </h1>
          <p className="text-sm text-muted-foreground">
            Update the copy used in every transactional email. The live preview
            renders the actual components our customers receive.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 self-start rounded-2xl border-border px-5 py-3 lg:self-auto"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save templates
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_420px]">
        <TemplateSidebar
          templates={mergedTemplates}
          activeType={currentTemplate.templateType}
          onSelect={setActiveTab}
        />

        <div className="space-y-6">
          <Card className="rounded-3xl border border-border/70 shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">
                    {TEMPLATE_METADATA[currentTemplate.templateType].title}
                  </CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    {TEMPLATE_METADATA[currentTemplate.templateType].subtitle}
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  {TEMPLATE_METADATA[currentTemplate.templateType].category}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {TEMPLATE_METADATA[currentTemplate.templateType].usage.map(
                  (item) => (
                    <Badge
                      key={item}
                      variant="secondary"
                      className="rounded-full border border-border bg-muted/40 text-xs font-medium text-muted-foreground"
                    >
                      {item}
                    </Badge>
                  ),
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-subject">Subject</Label>
                <Input
                  id="template-subject"
                  value={currentTemplate.subject}
                  onChange={(event) =>
                    updateSubject(
                      currentTemplate.templateType,
                      event.target.value,
                    )
                  }
                  placeholder="Your QR code is ready"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-description">Internal note</Label>
                <Textarea
                  id="template-description"
                  value={currentTemplate.description ?? ""}
                  onChange={(event) =>
                    updateDescription(
                      currentTemplate.templateType,
                      event.target.value,
                    )
                  }
                  rows={2}
                  placeholder="Optional context for other admins."
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/70 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Body copy</CardTitle>
              <CardDescription>
                Paragraphs are split whenever you add a blank line.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={currentTemplate.body}
                onChange={(event) =>
                  updateBody(currentTemplate.templateType, event.target.value)
                }
                rows={12}
                className="min-h-[260px] resize-none rounded-2xl border border-border/60 bg-background/70 font-medium text-base leading-relaxed"
                placeholder="Write the message customers should see…"
              />
              <p className="text-right text-xs text-muted-foreground">
                {currentTemplate.body.length.toLocaleString()} characters
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/70 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Advanced layout</CardTitle>
              <CardDescription>
                This only affects the admin preview for now—the production email
                layout is automatically generated.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="layout" className="border-none">
                  <AccordionTrigger className="rounded-2xl border border-border/50 px-4 text-left text-sm font-semibold">
                    Layout & visibility
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 px-1 pt-4">
                    {currentTemplate.structure?.elements.length ? (
                      <div className="space-y-3">
                        {currentTemplate.structure.elements.map(
                          (element, index) => (
                            <ElementEditor
                              key={`${element.type}-${index}`}
                              element={element}
                              index={index}
                              onToggleVisibility={() =>
                                toggleElementVisibility(
                                  currentTemplate.templateType,
                                  index,
                                )
                              }
                              onMoveUp={
                                index > 0
                                  ? () =>
                                      reorderElements(
                                        currentTemplate.templateType,
                                        index,
                                        index - 1,
                                      )
                                  : undefined
                              }
                              onMoveDown={
                                index <
                                (currentTemplate.structure?.elements.length ?? 0) -
                                  1
                                  ? () =>
                                      reorderElements(
                                        currentTemplate.templateType,
                                        index,
                                        index + 1,
                                      )
                                  : undefined
                              }
                              onUpdate={(updates) =>
                                updateElement(
                                  currentTemplate.templateType,
                                  index,
                                  updates,
                                )
                              }
                              onRemove={() =>
                                removeElement(currentTemplate.templateType, index)
                              }
                            />
                          ),
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No configurable elements for this template.
                      </p>
                    )}

                    {availableElements.length > 0 ? (
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                          Add element
                        </Label>
                        <Select
                          value=""
                          onValueChange={(value) => {
                            if (isEmailTemplateElementType(value)) {
                              addElement(currentTemplate.templateType, value);
                            }
                          }}
                        >
                          <SelectTrigger className="rounded-2xl border border-border/60 bg-background/70">
                            <SelectValue placeholder="Select element" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableElements.map((type) => {
                              const alreadyAdded = currentTemplate.structure?.elements.some(
                                (element) => element.type === type,
                              );
                              if (alreadyAdded && type !== "body_text") return null;
                              return (
                                <SelectItem key={type} value={type}>
                                  {type.replace(/_/g, " ")}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>

        <EmailTemplatePreviewPanel
          template={currentTemplate}
          fixture={previewFixture}
        />
      </div>
    </div>
  );
}

interface TemplateSidebarProps {
  templates: EmailTemplateRecord[];
  activeType: EmailTemplateType;
  onSelect: (type: EmailTemplateType) => void;
}

function TemplateSidebar({
  templates,
  activeType,
  onSelect,
}: TemplateSidebarProps) {
  return (
    <Card className="h-full rounded-3xl border border-border/80 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Templates</CardTitle>
        <CardDescription>
          Pick a flow to update copy and preview the final design.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {templates.map((template) => {
          const meta = TEMPLATE_METADATA[template.templateType];
          const isActive = template.templateType === activeType;
          return (
            <button
              key={template.templateType}
              type="button"
              onClick={() => onSelect(template.templateType)}
              className={cn(
                "w-full rounded-2xl border border-transparent px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                isActive
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/60 hover:border-border hover:bg-muted/30",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {meta.title}
                </p>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {meta.category}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                {formatUpdatedAt(template.updatedAt)}
              </p>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

interface ElementEditorProps {
  element: EmailTemplateElement;
  index: number;
  onToggleVisibility: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onUpdate: (updates: Partial<EmailTemplateElement>) => void;
  onRemove: () => void;
}

function ElementEditor({
  element,
  index,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onUpdate,
  onRemove,
}: ElementEditorProps) {
  const elementLabel =
    element.type.replace(/_/g, " ").replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    ) + ` · ${index + 1}`;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-background/70 p-4 transition",
        !element.visible && "opacity-60 ring-1 ring-border/60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          {elementLabel}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onToggleVisibility}
          >
            {element.visible ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onMoveUp}
            disabled={!onMoveUp}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onMoveDown}
            disabled={!onMoveDown}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {element.type === "body_text" ? (
          <p className="text-xs text-muted-foreground">
            This block renders the body copy above.
          </p>
        ) : null}

        {element.type === "greeting" && "customText" in element ? (
          <div className="space-y-2">
            <Label>Custom greeting</Label>
            <Input
              value={element.customText || ""}
              onChange={(event) =>
                onUpdate({ customText: event.target.value })
              }
              placeholder="Hi there,"
            />
          </div>
        ) : null}

        {element.type === "qr_code" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Label</Label>
              <Input
                value={element.label || ""}
                onChange={(event) => onUpdate({ label: event.target.value })}
                placeholder="QR code"
              />
            </div>
            <div className="space-y-1">
              <Label>Caption</Label>
              <Input
                value={element.caption || ""}
                onChange={(event) => onUpdate({ caption: event.target.value })}
                placeholder="Show this on arrival"
              />
            </div>
          </div>
        ) : null}

        {element.type === "action_button" ? (
          <div className="space-y-2">
            <Label>Button label</Label>
            <Input
              value={element.label || ""}
              onChange={(event) => onUpdate({ label: event.target.value })}
              placeholder="View details"
            />
          </div>
        ) : null}

        {element.type === "verification_code" ? (
          <div className="space-y-2">
            <Label>Code label</Label>
            <Input
              value={element.label || ""}
              onChange={(event) => onUpdate({ label: event.target.value })}
              placeholder="Verification code"
            />
            <div className="space-y-1">
              <Label>Style</Label>
              <Select
                value={element.format || "plain"}
                onValueChange={(value: "plain" | "highlighted") =>
                  onUpdate({ format: value })
                }
              >
                <SelectTrigger className="rounded-xl border border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plain">Plain</SelectItem>
                  <SelectItem value="highlighted">Highlighted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        {element.type === "invite_link" ? (
          <div className="space-y-2">
            <Label>Link label</Label>
            <Input
              value={element.label || ""}
              onChange={(event) => onUpdate({ label: event.target.value })}
              placeholder="Accept invitation"
            />
            <div className="flex items-center gap-2 rounded-xl border border-border/60 p-2">
              <Switch
                checked={element.buttonStyle ?? false}
                onCheckedChange={(checked) => onUpdate({ buttonStyle: checked })}
              />
              <span className="text-sm text-muted-foreground">
                Display invite as button
              </span>
            </div>
          </div>
        ) : null}

        {element.type === "footer" && "customText" in element ? (
          <div className="space-y-2">
            <Label>Footer text</Label>
            <Textarea
              value={element.customText || ""}
              rows={2}
              onChange={(event) => onUpdate({ customText: event.target.value })}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-3 border-t border-dashed border-border/60 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-destructive"
          onClick={onRemove}
        >
          Remove element
        </Button>
      </div>
    </div>
  );
}
