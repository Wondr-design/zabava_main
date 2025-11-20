export function toBooleanFlag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return ["true", "1", "yes", "on", "y", "t"].includes(normalized);
  }
  return false;
}

export function normalizePartnerNotifications(
  input: Record<string, unknown> | null | undefined,
): { email: boolean; sms: boolean; push: boolean } {
  return {
    email: toBooleanFlag(input?.email),
    sms: toBooleanFlag(input?.sms),
    push: toBooleanFlag(input?.push),
  };
}

export function normalizeStaffNotifications(
  input: Record<string, unknown> | null | undefined,
): { queue: boolean; redemptions: boolean } {
  return {
    queue: toBooleanFlag(input?.queue),
    redemptions: toBooleanFlag(input?.redemptions),
  };
}
