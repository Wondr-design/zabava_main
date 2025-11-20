"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import { UploadCloud, Loader2, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";

import { adminApi } from "@/lib/web/api-client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ImageUploadFieldProps {
  label: string;
  description?: string;
  value?: string | null;
  onChange: (next: string) => void;
  folder: string;
  allowClear?: boolean;
  helperText?: string;
  readOnlyUrl?: boolean;
}

export function ImageUploadField({
  label,
  description,
  value,
  onChange,
  folder,
  allowClear = true,
  helperText,
  readOnlyUrl = true,
}: ImageUploadFieldProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await adminApi.uploadImage(
        file,
        {
          folder,
          contentType: file.type,
        },
        {},
      );
      if (!result?.url) {
        toast.warning("Image uploaded but no URL returned. Check bucket permissions.");
      } else {
        toast.success("Image uploaded.");
      }
      onChange(result?.url ?? "");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to upload image.",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Image URL copied.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to copy URL.",
      );
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}

      {value ? (
        <div className="overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50">
          <div className="relative h-48 w-full">
            <Image
              src={value}
              alt={label}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
              unoptimized
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleUploadClick}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <UploadCloud className="mr-2 h-4 w-4" />
              Upload image
            </>
          )}
        </Button>
        {allowClear && value ? (
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => onChange("")}
            disabled={uploading}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        ) : null}
        {value ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleCopy}
            className="text-muted-foreground"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy URL
          </Button>
        ) : null}
      </div>

      <Input
        id={inputId}
        value={value ?? ""}
        onChange={(event) => {
          if (!readOnlyUrl) {
            onChange(event.target.value);
          }
        }}
        readOnly={readOnlyUrl}
        placeholder="Uploaded image URL"
      />
      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
