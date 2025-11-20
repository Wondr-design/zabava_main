import { randomUUID } from "node:crypto";
import QRCode from "qrcode";

import { getSupabaseAdmin } from "../supabase-admin";

export const DEFAULT_BUCKET = process.env.SUPABASE_QR_BUCKET || "qr-codes";
const MAX_SIGNED_URL_SECONDS = 60 * 60 * 24 * 7; // Supabase limit (7 days)
const MIN_SIGNED_URL_SECONDS = 60;
const FALLBACK_EXPIRY_DAYS = Number(
  process.env.QR_CODE_EXPIRES_IN_DAYS_DEFAULT ?? "3"
);
const ENV_QR_EXPIRY_DAYS = (() => {
  if (process.env.QR_CODE_EXPIRES_IN_DAYS) {
    return Number(process.env.QR_CODE_EXPIRES_IN_DAYS);
  }
  if (process.env.QR_CODE_EXPIRES_IN) {
    const legacy = Number(process.env.QR_CODE_EXPIRES_IN);
    if (Number.isFinite(legacy) && legacy > 0) {
      return legacy / (60 * 60 * 24);
    }
  }
  return undefined;
})();

function clampExpirySeconds(
  seconds: number | undefined,
  fallbackSeconds: number
) {
  if (!Number.isFinite(seconds) || (seconds as number) <= 0) {
    return fallbackSeconds;
  }
  const normalized = Math.floor(seconds as number);
  if (normalized < MIN_SIGNED_URL_SECONDS) return MIN_SIGNED_URL_SECONDS;
  if (normalized > MAX_SIGNED_URL_SECONDS) return MAX_SIGNED_URL_SECONDS;
  return normalized;
}

function daysToSeconds(days: number) {
  return days * 24 * 60 * 60;
}

const fallbackSeconds = clampExpirySeconds(
  daysToSeconds(FALLBACK_EXPIRY_DAYS),
  MIN_SIGNED_URL_SECONDS
);

const resolvedEnvSeconds = ENV_QR_EXPIRY_DAYS
  ? clampExpirySeconds(daysToSeconds(ENV_QR_EXPIRY_DAYS), fallbackSeconds)
  : fallbackSeconds;

export const DEFAULT_EXPIRY_SECONDS = resolvedEnvSeconds;

export interface QrCodeStyleOptions {
  badgeLabel?: string;
  badgeIconUrl?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  matrixColor?: string;
  footerLabel?: string;
  footerTextColor?: string;
  qrVariant?: "visit" | "reward" | "flash";
}

export interface QrCodeResult {
  url: string;
  expiresAt: string;
  path: string;
}

async function ensureSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds, { download: false });

  if (error || !data?.signedUrl) {
    throw new Error(
      `Failed to create signed QR URL: ${error?.message ?? "unknown error"}`
    );
  }

  const expiresAt = new Date(
    Date.now() + expiresInSeconds * 1000
  ).toISOString();
  return { url: data.signedUrl, expiresAt };
}

function resolveExpirySeconds(candidate?: number) {
  return clampExpirySeconds(candidate, DEFAULT_EXPIRY_SECONDS);
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeSvgAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatNumber(value: number) {
  return Number.parseFloat(value.toFixed(3)).toString();
}

type QrModules = {
  size: number;
  get(x: number, y: number): number;
};

function buildStyledQrSvg(value: string, options: QrCodeStyleOptions) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  if (!qr.modules) {
    throw new Error("Failed to render QR modules");
  }
  return renderStyledSvgFromModules(qr.modules as QrModules, options);
}

function isFinderModule(x: number, y: number, size: number) {
  const finderSize = 7;
  const topLeft = x < finderSize && y < finderSize;
  const topRight = x >= size - finderSize && y < finderSize;
  const bottomLeft = x < finderSize && y >= size - finderSize;
  return topLeft || topRight || bottomLeft;
}

function renderStyledSvgFromModules(
  modules: QrModules,
  options: QrCodeStyleOptions
) {
  const canvasSize = 450;
  const background = "#FFFFFF";
  const borderColor = options.borderColor ?? "#F5FAFA";
  const matrixColor = options.matrixColor ?? "#F5FAFA";
  const accentColor = options.badgeColor ?? "#F0B90B";
  const badgeTextColor = options.badgeTextColor ?? "#FFFFFF";
  const footerColor = options.footerTextColor ?? borderColor;
  const variant = options.qrVariant ?? "visit";
  const borderRadius = canvasSize * 0.12;
  const borderWidth = canvasSize * 0.02;
  const frameInset = borderWidth / 2;
  const moduleCount = modules.size;
  if (!moduleCount) {
    throw new Error("QR modules missing size");
  }
  const margin = canvasSize * 0.115;
  const moduleSize = (canvasSize - margin * 2) / moduleCount;
  const dotRadius = moduleSize * 0.38;
  const badgeRadius = canvasSize * 0.11;
  const badgeCx = canvasSize / 2;
  const badgeCy = canvasSize / 2;

  const dots: string[] = [];
  for (let y = 0; y < moduleCount; y += 1) {
    for (let x = 0; x < moduleCount; x += 1) {
      if (!modules.get(x, y)) continue;
      if (isFinderModule(x, y, moduleCount)) continue;
      const cx = margin + x * moduleSize + moduleSize / 2;
      const cy = margin + y * moduleSize + moduleSize / 2;
      const distanceToBadge = Math.hypot(cx - badgeCx, cy - badgeCy);
      if (distanceToBadge < badgeRadius + dotRadius * 0.9) continue;
      dots.push(
        `<circle cx="${formatNumber(cx)}" cy="${formatNumber(
          cy
        )}" r="${formatNumber(dotRadius)}" fill="${matrixColor}" />`
      );
    }
  }
  const dotsMarkup = dots.join("");

  const finderShape = resolveFinderShape(variant);
  const finders = [
    renderFinderBlock(
      "left",
      "top",
      canvasSize,
      margin,
      moduleSize,
      matrixColor,
      background,
      borderColor,
      finderShape
    ),
    renderFinderBlock(
      "right",
      "top",
      canvasSize,
      margin,
      moduleSize,
      matrixColor,
      background,
      borderColor,
      finderShape
    ),
    renderFinderBlock(
      "left",
      "bottom",
      canvasSize,
      margin,
      moduleSize,
      matrixColor,
      background,
      borderColor,
      finderShape
    ),
  ].join("");

  const badge = buildBadge(
    badgeCx,
    badgeCy,
    badgeRadius,
    accentColor,
    badgeTextColor,
    options
  );

  const footerLabel = options.footerLabel?.trim();
  const footerMarkup = footerLabel
    ? `<text x="${canvasSize / 2}" y="${formatNumber(
        canvasSize - margin * 0.35
      )}" text-anchor="middle" dominant-baseline="central" font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="${formatNumber(
        moduleSize * 2.4
      )}" font-weight="600" letter-spacing="0.15em" fill="${footerColor}">${escapeSvgText(
        footerLabel.toUpperCase()
      )}</text>`
    : "";

  const defs = badge.defs ? `<defs>${badge.defs}</defs>` : "";

  const frameWidth = canvasSize - borderWidth;
  const frameHeight = canvasSize - borderWidth;
  const frameX = frameInset;
  const frameY = frameInset;
  const frameRx = borderRadius - frameInset;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize} ${canvasSize}" shape-rendering="geometricPrecision">${defs}<rect x="${formatNumber(
    frameX
  )}" y="${formatNumber(frameY)}" width="${formatNumber(
    frameWidth
  )}" height="${formatNumber(frameHeight)}" rx="${formatNumber(
    frameRx
  )}" fill="${background}" stroke="${borderColor}" stroke-width="${formatNumber(
    borderWidth
  )}" />${finders}<g>${dotsMarkup}</g>${badge.markup}${footerMarkup}</svg>`;
}

type FinderShape = "square" | "diamond" | "hexagon";

function resolveFinderShape(
  variant: "visit" | "reward" | "flash"
): FinderShape {
  switch (variant) {
    case "reward":
      return "diamond";
    case "flash":
      return "hexagon";
    default:
      return "square";
  }
}

function renderFinderBlock(
  horizontal: "left" | "right",
  vertical: "top" | "bottom",
  canvasSize: number,
  margin: number,
  moduleSize: number,
  matrixColor: string,
  backgroundColor: string,
  borderColor: string,
  shape: FinderShape
) {
  const finderModules = 7;
  const outerSize = finderModules * moduleSize;
  const startX =
    horizontal === "left"
      ? margin
      : canvasSize - margin - outerSize;
  const startY =
    vertical === "top"
      ? margin
      : canvasSize - margin - outerSize;
  const innerOffset = moduleSize;
  const innerSize = outerSize - innerOffset * 2;
  const coreOffset = moduleSize * 2;
  const coreSize = outerSize - coreOffset * 2;
  const cornerRadius = moduleSize * 1.2;
  const centerX = startX + outerSize / 2;
  const centerY = startY + outerSize / 2;
  const layers = [
    renderFinderLayer(shape, centerX, centerY, outerSize, {
      fill: matrixColor,
      radius: cornerRadius,
      stroke: borderColor,
      strokeWidth: borderColor ? moduleSize * 0.05 : 0,
    }),
    renderFinderLayer(shape, centerX, centerY, innerSize, {
      fill: backgroundColor,
      radius: cornerRadius * 0.75,
      stroke: undefined,
    }),
    renderFinderLayer(shape, centerX, centerY, coreSize, {
      fill: matrixColor,
      radius: cornerRadius * 0.5,
      stroke: undefined,
    }),
  ];

  return `<g>${layers.join("")}</g>`;
}

function renderFinderLayer(
  shape: FinderShape,
  centerX: number,
  centerY: number,
  size: number,
  options: {
    fill: string;
    radius?: number;
    stroke?: string;
    strokeWidth?: number;
  }
) {
  const { fill, radius = 0, stroke, strokeWidth } = options;
  const half = size / 2;
  const strokeAttr = stroke ? ` stroke="${stroke}"` : "";
  const strokeWidthAttr =
    stroke && strokeWidth
      ? ` stroke-width="${formatNumber(strokeWidth)}"`
      : "";
  if (shape === "square") {
    return `<rect x="${formatNumber(centerX - half)}" y="${formatNumber(
      centerY - half
    )}" width="${formatNumber(size)}" height="${formatNumber(
      size
    )}" rx="${formatNumber(radius)}" fill="${fill}"${strokeAttr}${strokeWidthAttr} />`;
  }
  if (shape === "diamond") {
    return `<rect x="${formatNumber(centerX - half)}" y="${formatNumber(
      centerY - half
    )}" width="${formatNumber(size)}" height="${formatNumber(
      size
    )}" fill="${fill}" transform="rotate(45 ${formatNumber(
      centerX
    )} ${formatNumber(centerY)})"${strokeAttr}${strokeWidthAttr} />`;
  }
  const points = buildPolygonPoints(centerX, centerY, half, 6, Math.PI / 6);
  return `<polygon points="${points}" fill="${fill}"${strokeAttr}${strokeWidthAttr} />`;
}

function buildBadge(
  cx: number,
  cy: number,
  radius: number,
  accentColor: string,
  badgeTextColor: string,
  options: QrCodeStyleOptions
) {
  const label = options.badgeLabel?.trim();
  const badgeLabel = label ? label.slice(0, 2).toUpperCase() : "";
  const badgeIcon = options.badgeIconUrl?.trim();
  const clipId = badgeIcon
    ? `qrBadge-${Math.random().toString(36).slice(2, 10)}`
    : undefined;
  const defs = clipId
    ? `<clipPath id="${clipId}"><circle cx="${formatNumber(
        cx
      )}" cy="${formatNumber(cy)}" r="${formatNumber(radius)}" /></clipPath>`
    : "";
  let badgeContent = "";
  if (badgeIcon) {
    const iconSize = radius * 1.7;
    const iconX = cx - iconSize / 2;
    const iconY = cy - iconSize / 2;
    badgeContent = `<image href="${escapeSvgAttr(
      badgeIcon
    )}" x="${formatNumber(iconX)}" y="${formatNumber(
      iconY
    )}" width="${formatNumber(iconSize)}" height="${formatNumber(
      iconSize
    )}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})" />`;
  } else if (badgeLabel) {
    badgeContent = `<text x="${formatNumber(cx)}" y="${formatNumber(
      cy
    )}" text-anchor="middle" dominant-baseline="central" font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" font-size="${formatNumber(
      radius * 0.85
    )}" font-weight="700" letter-spacing="0.08em" fill="${badgeTextColor}">${escapeSvgText(
      badgeLabel
    )}</text>`;
  } else {
    badgeContent = renderDefaultBadgeGlyph(cx, cy, radius * 0.9, badgeTextColor);
  }
  const markup = `<g><circle cx="${formatNumber(cx)}" cy="${formatNumber(
    cy
  )}" r="${formatNumber(radius)}" fill="${accentColor}" />${badgeContent}</g>`;
  return { defs, markup };
}

function renderDefaultBadgeGlyph(
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  const diamond = (centerX: number, centerY: number, length: number) => {
    const half = length / 2;
    return `<rect x="${formatNumber(centerX - half)}" y="${formatNumber(
      centerY - half
    )}" width="${formatNumber(length)}" height="${formatNumber(
      length
    )}" fill="${color}" transform="rotate(45 ${formatNumber(
      centerX
    )} ${formatNumber(centerY)})" rx="${formatNumber(length * 0.15)}" />`;
  };
  const offset = size * 0.55;
  const large = size * 0.6;
  const small = size * 0.35;
  return `${diamond(cx, cy, large)}${diamond(cx, cy - offset, small)}${diamond(
    cx,
    cy + offset,
    small
  )}${diamond(cx - offset, cy, small)}${diamond(cx + offset, cy, small)}`;
}

function buildPolygonPoints(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  rotation = 0
) {
  const coords: string[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (Math.PI * 2 * i) / sides;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    coords.push(`${formatNumber(x)},${formatNumber(y)}`);
  }
  return coords.join(" ");
}

export async function generateQrCodeForVisit(
  verifyUrl: string,
  visitId: string,
  expiresInSeconds?: number,
  styleOptions?: QrCodeStyleOptions
): Promise<QrCodeResult> {
  if (!verifyUrl) {
    throw new Error("verifyUrl is required to generate QR code");
  }
  if (!visitId) {
    throw new Error("visitId is required to store QR code");
  }

  const mergedOptions: QrCodeStyleOptions = {
    backgroundColor: "#2A303D",
    borderColor: "#F5FAFA",
    badgeColor: "#F0B90B",
    badgeTextColor: "#FFFFFF",
    matrixColor: "#F5FAFA",
    ...styleOptions,
  };

  const svg = buildStyledQrSvg(verifyUrl, mergedOptions);
  const supabase = getSupabaseAdmin();
  const bucket = DEFAULT_BUCKET;
  const path = `visits/${visitId}/${randomUUID()}.svg`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, svg, {
      contentType: "image/svg+xml",
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(`Failed to upload QR code: ${uploadError.message}`);
  }

  const expirySeconds = resolveExpirySeconds(expiresInSeconds);
  const { url, expiresAt } = await ensureSignedUrl(bucket, path, expirySeconds);

  return { url, expiresAt, path };
}

export async function createSignedQrUrl(
  path: string,
  expiresInSeconds?: number
) {
  if (!path) {
    throw new Error("QR path is required to create signed URL");
  }
  const expirySeconds = resolveExpirySeconds(expiresInSeconds);
  return ensureSignedUrl(DEFAULT_BUCKET, path, expirySeconds);
}
