import { randomUUID } from "node:crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";

function levelPriority(level: LogLevel): number {
  switch (level) {
    case "debug":
      return 10;
    case "info":
      return 20;
    case "warn":
      return 30;
    case "error":
      return 40;
    default:
      return 20;
  }
}

function currentThreshold(): number {
  const lvl = (process.env.LOG_LEVEL || "info").toLowerCase();
  if (lvl === "debug") return levelPriority("debug");
  if (lvl === "warn") return levelPriority("warn");
  if (lvl === "error") return levelPriority("error");
  return levelPriority("info");
}

function safeError(err: unknown) {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  try {
    return { value: JSON.stringify(err) };
  } catch {
    return { value: String(err) };
  }
}

function emit(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
) {
  const threshold = currentThreshold();
  if (levelPriority(level) < threshold) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...context,
  } as Record<string, unknown>;
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (message: string, context?: Record<string, unknown>) =>
    emit("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    emit("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    emit("warn", message, context),
  error: (message: string, err?: unknown, context?: Record<string, unknown>) =>
    emit("error", message, { error: safeError(err), ...(context || {}) }),
};

export function getCorrelationId(
  req?: { headers?: Headers | Record<string, unknown> } | null
) {
  try {
    const h = req?.headers as Headers | undefined;
    const id = h?.get?.("x-correlation-id") || h?.get?.("x-request-id");
    if (id) return id;
  } catch {}
  // Attempt record-like headers
  try {
    const h2 = (req?.headers || {}) as Record<string, unknown>;
    const lower = Object.fromEntries(
      Object.entries(h2).map(([k, v]) => [k.toLowerCase(), String(v)])
    );
    const id = lower["x-correlation-id"] || lower["x-request-id"];
    if (id) return id;
  } catch {}
  return randomUUID();
}
