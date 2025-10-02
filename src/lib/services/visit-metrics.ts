const PARTNER_KEY_CANDIDATES = [
  'partner_id',
  'partnerId',
  'partner',
  'partnerID',
  'PartnerID',
  'Partner Id',
];

const TRANSPORT_POSITIVE = new Set(['yes', 'true', '1', 'y', 'checked', 'selected']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function pickFirst(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function extractPartnerId(source: unknown): string {
  if (!source) return '';

  const scan = (obj: Record<string, unknown>) => {
    for (const key of PARTNER_KEY_CANDIDATES) {
      const value = obj[key];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
    return '';
  };

  if (typeof source === 'string') {
    try {
      const parsed = JSON.parse(source);
      const value = extractPartnerId(parsed);
      if (value) return value;
    } catch {
      // ignore parse errors
    }
    return '';
  }

  if (Array.isArray(source)) {
    for (const item of source) {
      const value = extractPartnerId(item);
      if (value) return value;
    }
    return '';
  }

  if (isRecord(source)) {
    const direct = scan(source);
    if (direct) return direct;
    if (source.data) {
      return extractPartnerId(source.data);
    }
  }

  return '';
}

function resolveTransport(raw: unknown) {
  if (raw === undefined || raw === null || raw === '') {
    return { label: null, hasTransport: false };
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { label: null, hasTransport: false };
    }
    const lower = trimmed.toLowerCase();
    return {
      label: trimmed,
      hasTransport: TRANSPORT_POSITIVE.has(lower),
    };
  }

  if (typeof raw === 'boolean') {
    return { label: raw ? 'Yes' : 'No', hasTransport: raw };
  }

  return { label: String(raw), hasTransport: Boolean(raw) };
}

export interface RegistrationMetrics {
  totalPrice: number;
  numPeople: number;
  ticketType: string;
  transportLabel: string | null;
  hasTransport: boolean;
  categories: string | null;
  estimatedPoints: number;
}

export function computeRegistrationMetrics(payload: Record<string, unknown>): RegistrationMetrics {
  const totalPrice = toNumber(
    pickFirst(payload, ['totalPrice', 'price', 'orderValue', 'total_price', 'Total Price', 'TOTAL_PRICE']),
    0
  );

  const numPeople = Math.max(
    1,
    toNumber(pickFirst(payload, ['numPeople', 'people', 'guests', 'Num People', 'NUM_PEOPLE']), 1)
  );

  const ticketRaw = pickFirst(payload, ['ticketType', 'ticket', 'ticket_type', 'Ticket', 'TICKET']);
  const ticketType = ticketRaw ? String(ticketRaw) : 'Standard';

  const transportRaw = pickFirst(
    payload,
    ['transport', 'Transport', 'Bus_Rental', 'busRental', 'selectedBus']
  );
  const { label: transportLabel, hasTransport } = resolveTransport(transportRaw);

  const categoriesRaw = pickFirst(payload, ['categories', 'Categories', 'category', 'segment']);
  const categories = categoriesRaw ? String(categoriesRaw) : null;

  let estimatedPoints = toNumber(
    pickFirst(payload, ['estimatedPoints', 'estimated_points', 'Estimated Points', 'ESTIMATED_POINTS']),
    0
  );

  if (!estimatedPoints) {
    if (totalPrice > 0) {
      estimatedPoints = Math.floor(totalPrice / 100);
    } else {
      switch (ticketType.toLowerCase()) {
        case 'vip':
          estimatedPoints = 50 * numPeople;
          break;
        case 'family':
          estimatedPoints = 30 * numPeople;
          break;
        case 'group':
          estimatedPoints = 20 * numPeople;
          break;
        case 'student':
          estimatedPoints = 15 * numPeople;
          break;
        case 'adult':
          estimatedPoints = 11 * numPeople;
          break;
        default:
          estimatedPoints = 10 * numPeople;
          break;
      }
    }

    if (hasTransport) {
      estimatedPoints += 5;
    }
  }

  if (estimatedPoints < 0) {
    estimatedPoints = 0;
  }

  return {
    totalPrice,
    numPeople,
    ticketType,
    transportLabel,
    hasTransport,
    categories,
    estimatedPoints,
  };
}
