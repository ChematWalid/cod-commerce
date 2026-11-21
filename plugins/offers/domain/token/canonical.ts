/** `value` with the keys of every object, at every depth, in sorted order; arrays keep their order. */
function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value === null || typeof value !== 'object') return value;
  const entries = Object.entries(value).sort(([left], [right]) => (left < right ? -1 : 1));
  return Object.fromEntries(entries.map(([key, item]) => [key, sortedKeys(item)]));
}

/**
 * Canonical JSON of the quote token (ADR 0004, D2421): sorted keys at every depth, no whitespace, so one value has
 * exactly one spelling and its hash or signature is stable. Keys whose value is `undefined` are left out, as
 * `JSON.stringify` does.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortedKeys(value));
}
