const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
});

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: string | number | Date | null | undefined, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  return DATE_FORMATTER.format(date);
}

export function formatDateTime(value: string | number | Date | null | undefined, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  return DATE_TIME_FORMATTER.format(date);
}

export function formatTime(value: string | number | Date | null | undefined, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  return TIME_FORMATTER.format(date);
}
