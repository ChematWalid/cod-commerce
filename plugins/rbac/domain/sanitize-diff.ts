import { ACTIVITY_DIFF_MAX_BYTES, DIFF_MAX_DEPTH, DIFF_OMITTED_VALUE, REDACTED_VALUE } from './constants';

/** Keys whose values are secrets, in any case and spelling (D66). */
const SENSITIVE_KEY = /password|secret|token|otp|hash|api.?key|authorization|cookie/i;

/** What a diff becomes when it is too large to keep. */
export const TRUNCATED_DIFF: Readonly<Record<string, unknown>> = { truncated: true };

const encoder = new TextEncoder();

function sanitizeValue(value: unknown, depth: number, ancestors: ReadonlySet<object>): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object' || value === null) return value;
  if (depth >= DIFF_MAX_DEPTH || ancestors.has(value)) return DIFF_OMITTED_VALUE;
  const path = new Set(ancestors).add(value);
  if (Array.isArray(value)) return (value as unknown[]).map((item) => sanitizeValue(item, depth + 1, path));
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED_VALUE : sanitizeValue(inner, depth + 1, path),
    ]),
  );
}

/**
 * A copy of `diff` that is safe to store: values under sensitive keys are redacted at any depth, arrays are
 * walked, and a diff over {@link ACTIVITY_DIFF_MAX_BYTES} of JSON is replaced by `{ truncated: true }` (D66).
 */
export function sanitizeDiff(diff: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const clean = sanitizeValue(diff, 0, new Set()) as Record<string, unknown>;
  const size = encoder.encode(JSON.stringify(clean)).length;
  return size > ACTIVITY_DIFF_MAX_BYTES ? { ...TRUNCATED_DIFF } : clean;
}
