const DEFAULT_TICKET = "Standard";
const TRANSPORT_POSITIVE = new Set([
  "yes",
  "true",
  "1",
  "y",
  "checked",
  "selected",
]);

function normalizeEmail(value: unknown) {
  if (!value) return null;
  const trimmed = String(value).trim().toLowerCase();
  return trimmed || null;
}

function normalizePartnerId(value: unknown) {
  if (!value) return null;
  const trimmed = String(value).trim().toLowerCase();
  return trimmed || null;
}

function pickFirst(
  sources: Array<Record<string, unknown> | undefined | null>,
  keys: string | string[],
  fallback: unknown = undefined
) {
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const variants = Array.isArray(keys) ? keys : [keys];
    for (const key of variants) {
      if (key == null) continue;
      const value = source[key];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }
  return fallback;
}

function toNumber(value: unknown, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeTransport(raw: unknown) {
  if (raw === undefined || raw === null) {
    return { label: null, hasTransport: false };
  }
  if (typeof raw === "string") {
    const normalized = raw.trim();
    const lower = normalized.toLowerCase();
    if (TRANSPORT_POSITIVE.has(lower)) {
      return { label: normalized || "Yes", hasTransport: true };
    }
    if (!normalized) {
      return { label: null, hasTransport: false };
    }
    return { label: normalized, hasTransport: false };
  }
  if (typeof raw === "boolean") {
    return { label: raw ? "Yes" : "No", hasTransport: raw };
  }
  return { label: String(raw), hasTransport: Boolean(raw) };
}

function computePoints({
  existingPoints,
  estimatedPoints,
  totalPrice,
  ticketType,
  numPeople,
  hasTransport,
  computeAwardedPoints,
}: {
  existingPoints?: unknown;
  estimatedPoints?: unknown;
  totalPrice?: unknown;
  ticketType?: unknown;
  numPeople?: number;
  hasTransport?: boolean;
  computeAwardedPoints?: boolean;
}) {
  const cleanExisting = toNumber(existingPoints, 0);
  const cleanEstimated = toNumber(estimatedPoints, 0);

  if (computeAwardedPoints === false) {
    return {
      pointsAwarded: cleanExisting,
      estimatedPoints: cleanEstimated || cleanExisting || 0,
    };
  }

  if (cleanExisting > 0) {
    return {
      pointsAwarded: cleanExisting,
      estimatedPoints: cleanEstimated || cleanExisting,
    };
  }

  let points = cleanEstimated;
  if (!points) {
    const priceNum = toNumber(totalPrice, 0);
    if (priceNum > 0) {
      points = Math.floor(priceNum / 100);
    } else {
      const normalizedTicket = String(ticketType || "").toLowerCase();
      const nPeople =
        typeof numPeople === "number" && numPeople > 0 ? numPeople : 1;
      switch (normalizedTicket) {
        case "vip":
          points = 50 * nPeople;
          break;
        case "family":
          points = 30 * nPeople;
          break;
        case "group":
          points = 20 * nPeople;
          break;
        case "student":
          points = 15 * nPeople;
          break;
        default:
          points = 10 * nPeople;
          break;
      }
    }
    if (hasTransport) {
      points += 5;
    }
  }

  const normalizedPoints = points > 0 ? points : 0;
  return {
    pointsAwarded: normalizedPoints,
    estimatedPoints: cleanEstimated || normalizedPoints,
  };
}

export function normalizeVisitRecord(
  {
    payload = {},
    record = {},
    visitRecord = {},
    confirmation = {},
    meta = {},
  }: {
    payload?: Record<string, unknown>;
    record?: Record<string, unknown>;
    visitRecord?: Record<string, unknown>;
    confirmation?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  } = {},
  options: { computeAwardedPoints?: boolean } = {}
): NormalizedVisitRecord {
  const sources = [meta, confirmation, visitRecord, record, payload];

  const email = normalizeEmail(
    pickFirst(sources, ["email", "userEmail", "contactEmail"])
  );
  const partnerId = normalizePartnerId(
    pickFirst(sources, ["partnerId", "partner_id", "PartnerID"])
  );

  let partnerName = pickFirst(sources, [
    "partnerName",
    "attractionName",
    "partnerLabel",
    "name",
  ]);
  if (partnerName && typeof partnerName !== "string") {
    partnerName = String(partnerName);
  }

  const visitIdRaw = pickFirst(sources, "visitId");
  const visitId = visitIdRaw != null ? String(visitIdRaw) : null;
  const submissionIdRaw =
    pickFirst(sources, "submissionId") ||
    visitId ||
    pickFirst(sources, "qrKey");
  const submissionId = submissionIdRaw != null ? String(submissionIdRaw) : null;
  const qrKeyRaw = pickFirst(sources, "qrKey");
  const qrKey = qrKeyRaw != null ? String(qrKeyRaw) : null;

  const totalPrice = toNumber(
    pickFirst(sources, ["totalPrice", "price", "orderValue"]),
    0
  );
  const numPeople = Math.max(
    1,
    toNumber(pickFirst(sources, ["numPeople", "people", "guests"]), 1)
  );

  const rawTicket = pickFirst(sources, ["ticketType", "ticket", "ticket_type"]);
  const ticketType = rawTicket ? String(rawTicket) : DEFAULT_TICKET;
  const ticket = ticketType;

  const transportRaw = pickFirst(sources, [
    "transport",
    "Transport",
    "Bus_Rental",
    "busRental",
    "selectedBus",
  ]);
  const { label: transport, hasTransport } = normalizeTransport(transportRaw);

  const categoriesRaw = pickFirst(sources, [
    "categories",
    "Categories",
    "category",
    "segment",
  ]);
  const categories = categoriesRaw != null ? String(categoriesRaw) : null;

  const timeCreatedRaw = pickFirst(sources, [
    "createdAt",
    "timestamp",
    "registeredAt",
    "submittedAt",
  ]);
  const timeCreated = timeCreatedRaw != null ? String(timeCreatedRaw) : null;
  const visitDateRaw = pickFirst(sources, [
    "visitDate",
    "confirmedDate",
    "visitedAt",
  ]);
  const visitDate = visitDateRaw != null ? String(visitDateRaw) : null;
  const visitedAtRaw = pickFirst(sources, [
    "visitedAt",
    "confirmedDate",
    "visitDate",
  ]);
  const visitedAt = visitedAtRaw != null ? String(visitedAtRaw) : null;

  const statusRaw = pickFirst(sources, ["status"]);
  const status = statusRaw != null ? String(statusRaw) : null;

  let payloadForCalc = payload || {};
  if (payloadForCalc && typeof payloadForCalc === "object") {
    const rawData = payloadForCalc.data;
    if (typeof rawData === "string") {
      try {
        const decoded = JSON.parse(rawData);
        payloadForCalc = { ...payloadForCalc, ...decoded };
      } catch {
        // ignore malformed nested payloads
      }
    }
  }

  const metrics = computePoints({
    existingPoints: pickFirst(sources, "pointsAwarded"),
    estimatedPoints: pickFirst(sources, [
      "estimatedPoints",
      "points",
      "pointsEarned",
    ]),
    totalPrice,
    ticketType,
    numPeople,
    hasTransport,
    computeAwardedPoints: options.computeAwardedPoints !== false,
  });

  if (!partnerName) {
    partnerName = pickFirst(
      [payloadForCalc, record, confirmation],
      ["attractionName", "partnerLabel", "partnerName"]
    );
  }

  return {
    email,
    partnerId,
    partnerName: (partnerName as string | null | undefined) || null,
    visitId,
    submissionId,
    qrKey,
    totalPrice,
    estimatedPoints: metrics.estimatedPoints,
    pointsAwarded: metrics.pointsAwarded,
    numPeople,
    ticket,
    ticketType,
    transport,
    hasTransport,
    categories,
    createdAt: timeCreated || null,
    visitDate: visitDate || null,
    visitedAt: visitedAt || null,
    status: status || null,
  };
}

export interface NormalizedVisitRecord {
  email: string | null;
  partnerId: string | null;
  partnerName?: string | null;
  visitId?: string | null;
  submissionId?: string | null;
  qrKey?: string | null;
  totalPrice: number;
  estimatedPoints: number;
  pointsAwarded: number;
  numPeople: number;
  ticket: string | null;
  ticketType: string | null;
  transport: string | null;
  hasTransport: boolean;
  categories: string | null;
  createdAt: string | null;
  visitDate: string | null;
  visitedAt: string | null;
  status: string | null;
}

export { normalizeEmail, normalizePartnerId };
