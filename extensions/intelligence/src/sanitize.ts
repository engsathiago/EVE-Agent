import { redactToolPayloadText } from "eve-agent/plugin-sdk/logging-core";

const SECRET_KEY = /(authorization|api[_-]?key|password|passwd|secret|token|cookie)/i;
const MAX_TEXT = 24_000;

export function isSecretKey(key: string): boolean {
  return SECRET_KEY.test(key);
}

function cleanText(value: string): string {
  // Trace capture is an operator opt-in, but its content still enters durable
  // SQLite state. Use the same forced tools-mode redactor as other persisted
  // tool payloads so Bearer headers and standalone provider credentials do not leak.
  const redacted = redactToolPayloadText(value);
  return redacted.length <= MAX_TEXT ? redacted : `${redacted.slice(0, MAX_TEXT)}…[truncated]`;
}

export function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 6) {
    return "[depth-limited]";
  }
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value ?? null;
  }
  if (typeof value === "string") {
    return cleanText(value);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .slice(0, 100)
      .map(([key, item]) => [
        key,
        isSecretKey(key) ? "[REDACTED]" : sanitizeValue(item, depth + 1),
      ]);
    return Object.fromEntries(entries);
  }
  if (typeof value === "bigint") {
    return cleanText(value.toString());
  }
  return `[unsupported:${typeof value}]`;
}

export function sanitizeObject(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeValue(value);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : { value: sanitized };
}
