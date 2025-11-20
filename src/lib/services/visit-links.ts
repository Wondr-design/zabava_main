import type { VisitRegistrationRecord } from "@/lib/data/visits";

type VisitPayload = Record<string, unknown>;

function mergeDataIntoPayload(base: VisitPayload, source: unknown) {
  if (!source) return;
  if (typeof source === "string") {
    try {
      const parsed = JSON.parse(source) as VisitPayload;
      mergeDataIntoPayload(base, parsed);
    } catch {
      // ignore invalid JSON strings
    }
    return;
  }
  if (typeof source !== "object" || Array.isArray(source)) {
    return;
  }
  for (const [key, value] of Object.entries(source)) {
    if (base[key] === undefined) {
      base[key] = value;
    } else {
      base[`data.${key}`] = value;
    }
  }
}

export function expandVisitPayload(
  source: VisitRegistrationRecord | { payload?: unknown } | unknown,
): VisitPayload {
  if (!source || typeof source !== "object") return {};

  const payloadSource =
    "payload" in source
      ? ((source as { payload?: unknown }).payload as VisitPayload | undefined)
      : (source as VisitPayload);

  const base: VisitPayload = { ...(payloadSource ?? {}) };
  mergeDataIntoPayload(base, base.data);
  return base;
}

function extractFirstString(map: VisitPayload, keys: string[]): string | null {
  for (const key of keys) {
    const value = map[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export interface VisitLinkInfo {
  qrUrl: string | null;
  verifyUrl: string | null;
  qrExpiresAt: string | null;
  qrPath: string | null;
}

export function extractVisitLinks(
  source: VisitRegistrationRecord | { payload?: unknown } | VisitPayload | null | undefined,
): VisitLinkInfo {
  const map = expandVisitPayload(source ?? {});

  const qrUrl = extractFirstString(map, [
    "qrCodeUrl",
    "qrCodeURL",
    "QRCodeUrl",
    "qr_code",
    "qrCode",
    "qrUrl",
    "qr_url",
  ]);

  const verifyUrl = extractFirstString(map, ["verifyUrl", "verify_url"]);

  const qrExpiresAt = extractFirstString(map, [
    "qrCodeExpiresAt",
    "qr_code_expires_at",
    "qrExpiresAt",
    "qr_expires_at",
  ]);

  const qrPath = extractFirstString(map, [
    "qrStoragePath",
    "qr_storage_path",
    "qrPath",
    "qr_path",
  ]);

  return {
    qrUrl,
    verifyUrl,
    qrExpiresAt,
    qrPath,
  };
}

export function formatUrlDisplay(url: string, maxLength = 64) {
  try {
    const parsed = new URL(url);
    const printable = `${parsed.hostname}${parsed.pathname}${parsed.search || ""}`;
    if (printable.length <= maxLength) return printable;
    return `${printable.slice(0, maxLength)}…`;
  } catch {
    return url.length > maxLength ? `${url.slice(0, maxLength)}…` : url;
  }
}

function ensureLinkInfo(
  source:
    | VisitRegistrationRecord
    | { payload?: unknown }
    | VisitPayload
    | VisitLinkInfo
    | null
    | undefined,
): VisitLinkInfo {
  if (
    source &&
    typeof source === "object" &&
    "qrUrl" in source &&
    "verifyUrl" in source &&
    "qrExpiresAt" in source
  ) {
    const info = source as VisitLinkInfo;
    return {
      qrUrl: info.qrUrl ?? null,
      verifyUrl: info.verifyUrl ?? null,
      qrExpiresAt: info.qrExpiresAt ?? null,
      qrPath: info.qrPath ?? null,
    };
  }
  return extractVisitLinks(source as VisitRegistrationRecord | { payload?: unknown } | VisitPayload | null | undefined);
}

export interface VisitQrExpiryStatus {
  expiresAt: string | null;
  expiresAtDate: Date | null;
  expired: boolean;
  valid: boolean;
}

export function getVisitQrExpiryStatus(
  source:
    | VisitRegistrationRecord
    | { payload?: unknown }
    | VisitPayload
    | VisitLinkInfo
    | null
    | undefined,
  now: Date = new Date(),
): VisitQrExpiryStatus {
  const linkInfo = ensureLinkInfo(source);
  const raw = linkInfo.qrExpiresAt;
  if (!raw) {
    return {
      expiresAt: null,
      expiresAtDate: null,
      expired: false,
      valid: true,
    };
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return {
      expiresAt: raw,
      expiresAtDate: null,
      expired: false,
      valid: true,
    };
  }
  const expiresAtIso = parsed.toISOString();
  const expired = parsed.getTime() <= now.getTime();
  return {
    expiresAt: expiresAtIso,
    expiresAtDate: parsed,
    expired,
    valid: !expired,
  };
}
