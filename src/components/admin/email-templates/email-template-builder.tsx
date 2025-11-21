"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Save,
  ChevronUp,
  ChevronDown,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmailTemplateRecord } from "@/lib/data/email-templates";
import { adminApi } from "@/lib/web/api-client";
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
} from "@/lib/types/email-template-structure";
import {
  AVAILABLE_ELEMENTS_BY_TYPE,
  getDefaultStructure,
} from "@/lib/types/email-template-structure";
import { EmailTemplatePreview } from "./email-template-preview";

const TEMPLATE_LABELS: Record<
  EmailTemplateType,
  { title: string; subtitle: string }
> = {
  qr_delivery: {
    title: "QR delivery",
    subtitle: "Sent when we generate a QR (visits, rewards, flash deals).",
  },
  visit_confirmed: {
    title: "Visit confirmed",
    subtitle: "Sent after staff marks a visit as visited/confirmed.",
  },
  visit_updated: {
    title: "Visit updated",
    subtitle: "Sent when staff edits a visitor's details.",
  },
  invite_partner: {
    title: "Partner invite",
    subtitle: "Sent to partners with their invite link.",
  },
  invite_staff: {
    title: "Staff invite",
    subtitle: "Sent to staff with their invite link.",
  },
  verification_code: {
    title: "Verification code",
    subtitle: "Sent for any email verification flow.",
  },
  billing_report: {
    title: "Billing report",
    subtitle: "Sent monthly with CSV/XLSX attachments.",
  },
};

interface EmailTemplateBuilderProps {
  initialTemplates: EmailTemplateRecord[];
  locale: string;
}

export function EmailTemplateBuilder({
  initialTemplates,
  locale,
}: EmailTemplateBuilderProps) {
  const [templates, setTemplates] =
    useState<EmailTemplateRecord[]>(initialTemplates);
  const [saving, setSaving] = useState(false);
  const [csrfToken] = useState(() => getCsrfToken());
  const [activeTab, setActiveTab] = useState<EmailTemplateType>(
    emailTemplateTypes[0]
  );

  const mergedTemplates = useMemo(() => {
    return emailTemplateTypes.map((type) => {
      const existing = templates.find((t) => t.templateType === type);
      if (existing) {
        // Ensure structure exists
        if (!existing.structure) {
          return {
            ...existing,
            structure: getDefaultStructure(type),
          };
        }
        return existing;
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
      mergedTemplates.find((t) => t.templateType === activeTab) ??
      mergedTemplates[0]
    );
  }, [mergedTemplates, activeTab]);

  const availableElements = useMemo(() => {
    return AVAILABLE_ELEMENTS_BY_TYPE[currentTemplate.templateType] || [];
  }, [currentTemplate.templateType]);

  const dirty = useMemo(() => {
    return mergedTemplates.some((template) => {
      const initial = initialTemplates.find(
        (t) =>
          t.templateType === template.templateType &&
          (t.locale === template.locale || !t.locale)
      );
      if (!initial) return true;
      return (
        initial.subject !== template.subject ||
        initial.body !== template.body ||
        JSON.stringify(initial.structure) !==
          JSON.stringify(template.structure) ||
        (initial.description ?? undefined) !==
          (template.description ?? undefined)
      );
    });
  }, [mergedTemplates, initialTemplates]);

  const updateTemplate = useCallback(
    (type: EmailTemplateType, updates: Partial<EmailTemplateRecord>) => {
      setTemplates((prev) =>
        prev.map((t) =>
          t.templateType === type && t.locale === locale
            ? { ...t, ...updates }
            : t
        )
      );
    },
    [locale]
  );

  const updateTemplateStructure = useCallback(
    (type: EmailTemplateType, structure: EmailTemplateStructure) => {
      updateTemplate(type, { structure });
    },
    [updateTemplate]
  );

  const updateSubject = useCallback(
    (type: EmailTemplateType, subject: string) => {
      updateTemplate(type, { subject });
    },
    [updateTemplate]
  );

  const updateBody = useCallback(
    (type: EmailTemplateType, body: string) => {
      updateTemplate(type, { body });
    },
    [updateTemplate]
  );

  const reorderElements = useCallback(
    (type: EmailTemplateType, fromIndex: number, toIndex: number) => {
      const template = mergedTemplates.find((t) => t.templateType === type);
      if (!template?.structure) return;

      const newElements = [...template.structure.elements];
      const [moved] = newElements.splice(fromIndex, 1);
      newElements.splice(toIndex, 0, moved);

      updateTemplateStructure(type, { elements: newElements });
    },
    [mergedTemplates, updateTemplateStructure]
  );

  const toggleElementVisibility = useCallback(
    (type: EmailTemplateType, elementIndex: number) => {
      const template = mergedTemplates.find((t) => t.templateType === type);
      if (!template?.structure) return;

      const newElements = [...template.structure.elements];
      newElements[elementIndex] = {
        ...newElements[elementIndex],
        visible: !newElements[elementIndex].visible,
      };

      updateTemplateStructure(type, { elements: newElements });
    },
    [mergedTemplates, updateTemplateStructure]
  );

  const updateElement = useCallback(
    (
      type: EmailTemplateType,
      elementIndex: number,
      updates: Partial<EmailTemplateElement>
    ) => {
      const template = mergedTemplates.find((t) => t.templateType === type);
      if (!template?.structure) return;

      const newElements = [...template.structure.elements];
      newElements[elementIndex] = {
        ...newElements[elementIndex],
        ...updates,
      } as EmailTemplateElement;

      updateTemplateStructure(type, { elements: newElements });
    },
    [mergedTemplates, updateTemplateStructure]
  );

  const addElement = useCallback(
    (type: EmailTemplateType, elementType: string) => {
      const template = mergedTemplates.find((t) => t.templateType === type);
      if (!template?.structure) return;

      const available = AVAILABLE_ELEMENTS_BY_TYPE[type] || [];
      if (!available.includes(elementType as any)) return;

      const newElement: EmailTemplateElement = (() => {
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
            return {
              type: "verification_code",
              visible: true,
              format: "highlighted",
            };
          case "invite_link":
            return { type: "invite_link", visible: true, buttonStyle: true };
          default:
            return { type: "greeting", visible: true };
        }
      })();

      const newElements = [...template.structure.elements, newElement];
      updateTemplateStructure(type, { elements: newElements });
    },
    [mergedTemplates, updateTemplateStructure]
  );

  const removeElement = useCallback(
    (type: EmailTemplateType, elementIndex: number) => {
      const template = mergedTemplates.find((t) => t.templateType === type);
      if (!template?.structure) return;

      const newElements = template.structure.elements.filter(
        (_, i) => i !== elementIndex
      );
      updateTemplateStructure(type, { elements: newElements });
    },
    [mergedTemplates, updateTemplateStructure]
  );

  async function handleSave() {
    setSaving(true);
    try {
      await adminApi.emailTemplatesSave(
        { templates: mergedTemplates },
        { headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined }
      );
      toast.success("Templates saved");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save templates";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Email templates
          </p>
          <h1 className="text-2xl font-bold leading-tight">System emails</h1>
          <p className="text-sm text-muted-foreground">
            Customize email templates with visual editor. Arrange elements,
            toggle visibility, and preview how emails will look.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save templates
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as EmailTemplateType)}
        >
          <div className="border-b border-border px-6 pt-4">
            <TabsList className="bg-transparent">
              {mergedTemplates.map((template) => {
                const labels = TEMPLATE_LABELS[template.templateType];
                return (
                  <TabsTrigger
                    key={template.templateType}
                    value={template.templateType}
                    className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-foreground data-[state=active]:rounded-none"
                  >
                    {labels.title}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {mergedTemplates.map((template) => {
            const labels = TEMPLATE_LABELS[template.templateType];
            const defaults = EMAIL_TEMPLATE_DEFAULTS[template.templateType];
            const structure =
              template.structure || getDefaultStructure(template.templateType);

            return (
              <TabsContent
                key={template.templateType}
                value={template.templateType}
                className="p-6 mt-0"
              >
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Template Editor */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-lg font-semibold text-foreground">
                          {labels.title}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {labels.subtitle}
                        </p>
                      </div>

                      {/* Subject */}
                      <div className="space-y-2">
                        <Label htmlFor={`subject-${template.templateType}`}>
                          Subject
                        </Label>
                        <Input
                          id={`subject-${template.templateType}`}
                          value={template.subject}
                          onChange={(e) =>
                            updateSubject(template.templateType, e.target.value)
                          }
                          placeholder={defaults.subject}
                        />
                      </div>

                      {/* Body Text (for body_text elements) */}
                      <div className="space-y-2">
                        <Label htmlFor={`body-${template.templateType}`}>
                          Body Text
                        </Label>
                        <Textarea
                          id={`body-${template.templateType}`}
                          value={template.body}
                          onChange={(e) =>
                            updateBody(template.templateType, e.target.value)
                          }
                          rows={6}
                          className="resize-none"
                          placeholder={defaults.body}
                        />
                        <p className="text-xs text-muted-foreground">
                          Main body content. This will be used by body_text
                          elements.
                        </p>
                      </div>

                      {/* Template Structure Editor */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Template Elements</Label>
                          <Select
                            value=""
                            onValueChange={(value) => {
                              if (value) {
                                addElement(template.templateType, value);
                              }
                            }}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Add element" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableElements.map((elementType) => {
                                const alreadyAdded = structure.elements.some(
                                  (e) => e.type === elementType
                                );
                                if (alreadyAdded && elementType !== "body_text")
                                  return null;
                                return (
                                  <SelectItem
                                    key={elementType}
                                    value={elementType}
                                  >
                                    {elementType
                                      .replace(/_/g, " ")
                                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          {structure.elements.map((element, index) => (
                            <ElementEditor
                              key={`${element.type}-${index}`}
                              element={element}
                              index={index}
                              templateType={template.templateType}
                              onToggleVisibility={() =>
                                toggleElementVisibility(
                                  template.templateType,
                                  index
                                )
                              }
                              onMoveUp={
                                index > 0
                                  ? () =>
                                      reorderElements(
                                        template.templateType,
                                        index,
                                        index - 1
                                      )
                                  : undefined
                              }
                              onMoveDown={
                                index < structure.elements.length - 1
                                  ? () =>
                                      reorderElements(
                                        template.templateType,
                                        index,
                                        index + 1
                                      )
                                  : undefined
                              }
                              onUpdate={(updates) =>
                                updateElement(
                                  template.templateType,
                                  index,
                                  updates
                                )
                              }
                              onRemove={() =>
                                removeElement(template.templateType, index)
                              }
                              bodyText={template.body}
                              onBodyTextChange={(text) =>
                                updateBody(template.templateType, text)
                              }
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-2">
                        Preview
                      </h3>
                      <EmailTemplatePreview
                        template={template}
                        structure={structure}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </div>
  );
}

interface ElementEditorProps {
  element: EmailTemplateElement;
  index: number;
  templateType: EmailTemplateType;
  onToggleVisibility: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onUpdate: (updates: Partial<EmailTemplateElement>) => void;
  onRemove: () => void;
  bodyText: string;
  onBodyTextChange: (text: string) => void;
}

function ElementEditor({
  element,
  index,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onUpdate,
  onRemove,
  bodyText,
  onBodyTextChange,
}: ElementEditorProps) {
  const elementLabel =
    element.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) +
    ` (${index + 1})`;

  return (
    <Card className={cn("border", !element.visible && "opacity-50")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">
              {elementLabel}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleVisibility}
              aria-label={element.visible ? "Hide element" : "Show element"}
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
              onClick={onMoveUp}
              disabled={!onMoveUp}
              aria-label="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onMoveDown}
              disabled={!onMoveDown}
              aria-label="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Element-specific configuration */}
        {element.type === "body_text" && (
          <div className="space-y-2">
            <Label>Body Content</Label>
            <Textarea
              value={bodyText}
              onChange={(e) => onBodyTextChange(e.target.value)}
              rows={4}
              className="resize-none"
              placeholder="Enter email body text..."
            />
          </div>
        )}

        {element.type === "greeting" && "customText" in element && (
          <div className="space-y-2">
            <Label>Custom Greeting</Label>
            <Input
              value={element.customText || ""}
              onChange={(e) => onUpdate({ customText: e.target.value })}
              placeholder="Hi there,"
            />
          </div>
        )}

        {element.type === "qr_code" && (
          <div className="space-y-2">
            <Label>QR Code Label</Label>
            <Input
              value={element.label || ""}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="Your QR code"
            />
            <Label>Caption</Label>
            <Input
              value={element.caption || ""}
              onChange={(e) => onUpdate({ caption: e.target.value })}
              placeholder="Keep this handy for check-in"
            />
          </div>
        )}

        {element.type === "action_button" && (
          <div className="space-y-2">
            <Label>Button Label</Label>
            <Input
              value={element.label || ""}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="View Details"
            />
          </div>
        )}

        {element.type === "verification_code" && (
          <div className="space-y-2">
            <Label>Code Label</Label>
            <Input
              value={element.label || ""}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="Verification Code"
            />
            <div className="flex items-center gap-2">
              <Label>Format</Label>
              <Select
                value={element.format || "plain"}
                onValueChange={(value: "plain" | "highlighted") =>
                  onUpdate({ format: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plain">Plain</SelectItem>
                  <SelectItem value="highlighted">Highlighted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {element.type === "invite_link" && (
          <div className="space-y-2">
            <Label>Link Label</Label>
            <Input
              value={element.label || ""}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="Accept Invitation"
            />
            <div className="flex items-center gap-2">
              <Switch
                checked={element.buttonStyle ?? false}
                onCheckedChange={(checked) =>
                  onUpdate({ buttonStyle: checked })
                }
              />
              <Label>Button Style</Label>
            </div>
          </div>
        )}

        {element.type === "footer" && "customText" in element && (
          <div className="space-y-2">
            <Label>Custom Footer Text</Label>
            <Textarea
              value={element.customText || ""}
              onChange={(e) => onUpdate({ customText: e.target.value })}
              rows={2}
              placeholder="Thank you!"
            />
          </div>
        )}

        <div className="pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="w-full text-destructive hover:text-destructive"
          >
            Remove Element
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
