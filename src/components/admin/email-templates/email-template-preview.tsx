"use client";

import { useMemo } from "react";
import type { EmailTemplateRecord } from "@/lib/data/email-templates";
import type {
  EmailTemplateElement,
  EmailTemplateStructure,
} from "@/lib/types/email-template-structure";
import { cn } from "@/lib/utils";

interface EmailTemplatePreviewProps {
  template: EmailTemplateRecord;
  structure: EmailTemplateStructure;
}

export function EmailTemplatePreview({
  template,
  structure,
}: EmailTemplatePreviewProps) {
  const visibleElements = useMemo(() => {
    return structure.elements.filter((e) => e.visible);
  }, [structure.elements]);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {/* Email Preview Container */}
      <div className="mx-auto max-w-2xl rounded-lg border border-border bg-white shadow-lg">
        {/* Email Header */}
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <div className="text-sm text-muted-foreground">
            <div className="font-semibold text-foreground">
              To: recipient@example.com
            </div>
            <div className="mt-1">Subject: {template.subject}</div>
          </div>
        </div>

        {/* Email Body */}
        <div className="px-6 py-6 space-y-4">
          {visibleElements.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No visible elements
            </p>
          ) : (
            visibleElements.map((element, index) => (
              <ElementPreview
                key={`${element.type}-${index}`}
                element={element}
                template={template}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface ElementPreviewProps {
  element: EmailTemplateElement;
  template: EmailTemplateRecord;
}

function ElementPreview({ element, template }: ElementPreviewProps) {
  switch (element.type) {
    case "greeting":
      return (
        <div className="text-base font-medium text-foreground">
          {element.customText || "Hi there,"}
        </div>
      );

    case "body_text":
      return (
        <div className="space-y-2">
          {template.body.split("\n").map((line, i) => (
            <p key={i} className="text-sm text-foreground leading-relaxed">
              {line || "\u00A0"}
            </p>
          ))}
        </div>
      );

    case "qr_code":
      return (
        <div className="space-y-2">
          {element.label && (
            <p className="text-sm font-semibold text-foreground">
              {element.label}
            </p>
          )}
          <div className="inline-block rounded-lg border border-border bg-muted p-4">
            <div className="flex h-48 w-48 items-center justify-center rounded bg-slate-200 text-xs text-muted-foreground">
              [QR Code Preview]
            </div>
          </div>
          {element.caption && (
            <p className="text-xs text-muted-foreground">{element.caption}</p>
          )}
        </div>
      );

    case "details_table":
      return (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border">
                <td className="px-4 py-2 font-semibold text-muted-foreground">
                  Visit ID
                </td>
                <td className="px-4 py-2 text-foreground">VIS-123456</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-2 font-semibold text-muted-foreground">
                  Expires
                </td>
                <td className="px-4 py-2 text-foreground">2024-12-31</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-semibold text-muted-foreground">
                  Partner
                </td>
                <td className="px-4 py-2 text-foreground">Sample Partner</td>
              </tr>
            </tbody>
          </table>
        </div>
      );

    case "action_button":
      return (
        <div className="pt-2">
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            {element.label || "View Details"}
          </button>
        </div>
      );

    case "verification_code":
      return (
        <div className="space-y-2">
          {element.label && (
            <p className="text-sm font-semibold text-foreground">
              {element.label}
            </p>
          )}
          <div
            className={cn(
              "inline-block rounded-md px-4 py-2 text-lg font-mono font-semibold",
              element.format === "highlighted"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-muted text-foreground"
            )}
          >
            123456
          </div>
        </div>
      );

    case "invite_link":
      return (
        <div className="pt-2">
          {element.buttonStyle ? (
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              {element.label || "Accept Invitation"}
            </button>
          ) : (
            <a
              href="#"
              className="text-sm font-medium text-primary underline hover:no-underline"
            >
              {element.label || "Accept Invitation"}
            </a>
          )}
        </div>
      );

    case "footer":
      return (
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {element.customText || "Thank you for using our service!"}
          </p>
        </div>
      );

    default:
      return null;
  }
}
