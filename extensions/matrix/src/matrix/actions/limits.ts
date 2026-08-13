// Matrix plugin module implements limits behavior.
import { resolveIntegerOption } from "eve-agent/plugin-sdk/number-runtime";

export function resolveMatrixActionLimit(raw: unknown, fallback: number): number {
  return resolveIntegerOption(raw, fallback, { min: 1 });
}
