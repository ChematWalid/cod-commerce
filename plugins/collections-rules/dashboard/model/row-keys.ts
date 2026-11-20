/**
 * Client-side keys for the rule's rows. A row has no id of its own, and a row keyed by its place would hand its typed
 * but unadded title word to the next row when one before it is removed, so each row keeps a key minted once.
 */

/**
 * The keys for `count` rows: the current ones kept in order, new rows (always added at the end) minted a key, rows no
 * longer there dropped. The same list is answered while the count is unchanged.
 */
export function rowKeysFor(keys: readonly string[], count: number, mint: () => string): readonly string[] {
  if (keys.length === count) return keys;
  if (keys.length > count) return keys.slice(0, count);
  return [...keys, ...Array.from({ length: count - keys.length }, mint)];
}

/** The keys once the row at `index` is removed. */
export const withoutRowKey = (keys: readonly string[], index: number): readonly string[] =>
  keys.filter((_, at) => at !== index);
