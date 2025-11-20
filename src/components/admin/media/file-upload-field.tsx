"use client";

import { useId, useRef, useState } from "react";
import { Loader2, Upload, Trash2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

import { adminApi } from "@/lib/web/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FileUploadFieldProps {
  label: string;
  description?: string;
  value?: string | null;
  onChange: (next: string) => void;
  folder: string;
  accept?: string;
  helperText?: string;
}

export function FileUploadField({
  label,
  description,
  value,
  onChange,
  folder,
  accept,
  helperText,
}: FileUploadFieldProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await adminApi.uploadFile(
        file,
        {
          folder,
          contentType: file.type,
        },
        {},
      );
      if (!result?.url) {
        toast.warning(
          "File uploaded but no URL returned. Check bucket permissions.",
        );
      } else {
        toast.success("File uploaded.");
      }
      onChange(result?.url ?? "");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload file.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const fileName = value ? value.split("/").pop() : null;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleSelect}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload file
            </>
          )}
        </Button>
        {value ? (
          <>
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                if (value) {
                  window.open(value, "_blank", "noopener,noreferrer");
                }
              }}
            >
              <LinkIcon className="mr-2 h-4 w-4" />
              View current
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => onChange("")}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
          </>
        ) : null}
      </div>
      {value ? (
        <Input
          id={inputId}
          value={fileName ?? value}
          readOnly
          className="cursor-default"
        />
      ) : (
        <Input id={inputId} value="" readOnly placeholder="No file uploaded" />
      )}
      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
