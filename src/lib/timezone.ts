const DEFAULT_TIME_ZONE = "UTC";

export function isValidTimeZone(timeZone: string | null | undefined) {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function toTimeZoneDate(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const values = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  const year = Number(values.year ?? date.getUTCFullYear());
  const month = Number(values.month ?? date.getUTCMonth() + 1);
  const day = Number(values.day ?? date.getUTCDate());
  const hour = Number(values.hour ?? date.getUTCHours());
  const minute = Number(values.minute ?? date.getUTCMinutes());
  const second = Number(values.second ?? date.getUTCSeconds());

  return new Date(year, month - 1, day, hour, minute, second);
}

export function getWeekdayInTimeZone(date: Date, timeZone: string | null | undefined) {
  if (!timeZone) {
    return date.getDay();
  }
  try {
    const converted = toTimeZoneDate(date, timeZone);
    return converted.getDay();
  } catch {
    return date.getDay();
  }
}

export function formatTimeZoneLabel(timeZone: string | null | undefined) {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const namePart = parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
    const normalized = namePart.replace(/^GMT/, "UTC");
    return `${normalized} · ${timeZone}`;
  } catch {
    return timeZone;
  }
}
