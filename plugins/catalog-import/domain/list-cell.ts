import { IMPORT_LIST_SEPARATOR } from '@cod/shared';

/** The escape character of list cells and product keys (D2261). */
const ESCAPE = '\\';
const ID_KEY_PREFIX = 'id:';
/** A list item's `\` and `;` written escaped, so an item holding the separator survives the round trip. */
const NEEDS_ESCAPE = /[\\;]/g;

/**
 * A list cell (`tags`, `image_urls`) as an export writes it (D2209, D2261): the items joined by `;`, each `\` and `;`
 * inside an item escaped with `\`; `null` for no item.
 */
export function joinListCell(values: readonly string[]): string | null {
  if (values.length === 0) return null;
  return values
    .map((value) => value.replace(NEEDS_ESCAPE, (character) => `${ESCAPE}${character}`))
    .join(IMPORT_LIST_SEPARATOR);
}

/**
 * The items of a list cell (D2261): split on each `;` not escaped, `\\` and `\;` unescaped (any other `\` kept as
 * written, so a hand-made `C:\x` stays), each item trimmed, empty items dropped.
 */
export function splitListCell(cell: string): string[] {
  const items: string[] = [];
  let current = '';
  for (let at = 0; at < cell.length; at += 1) {
    const character = cell.charAt(at);
    const next = cell.charAt(at + 1);
    if (character === ESCAPE && (next === ESCAPE || next === IMPORT_LIST_SEPARATOR)) {
      current += next;
      at += 1;
    } else if (character === IMPORT_LIST_SEPARATOR) {
      items.push(current);
      current = '';
    } else current += character;
  }
  items.push(current);
  return items.map((item) => item.trim()).filter((item) => item !== '');
}

const startsWithIdKey = (value: string): boolean => value.trim().toLowerCase().startsWith(ID_KEY_PREFIX);

/**
 * The `product_key` cell of a product SKU (D2261): a SKU that starts with `id:` (any case) or `\` is written behind a
 * `\`, so the import reads it back as a SKU, never as a product id.
 */
export function productKeyCell(sku: string): string {
  return startsWithIdKey(sku) || sku.startsWith(ESCAPE) ? `${ESCAPE}${sku}` : sku;
}

/** What a `product_key` cell names: a product id (`id:<n>`, any case) or a product SKU. */
export type ParsedProductKey =
  { readonly kind: 'id'; readonly productId: string } | { readonly kind: 'sku'; readonly sku: string };

/** Reads a non-empty `product_key` cell written by {@link productKeyCell} or by hand (D2209, D2261). */
export function parseProductKey(cell: string): ParsedProductKey {
  if (cell.startsWith(ESCAPE)) return { kind: 'sku', sku: cell.slice(ESCAPE.length) };
  const trimmed = cell.trim();
  if (startsWithIdKey(trimmed)) return { kind: 'id', productId: trimmed.slice(ID_KEY_PREFIX.length).trim() };
  return { kind: 'sku', sku: trimmed };
}
