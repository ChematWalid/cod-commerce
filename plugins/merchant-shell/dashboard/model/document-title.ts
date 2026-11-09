/** The name the stock dashboard writes into the tab title (`use-page-title.ts`, 3.8.1). */
export const STOCK_TITLE_BRAND = 'Vendure';

/** What the stock title puts between the page and its brand. */
const TITLE_SEPARATOR = ' • ';

/**
 * Replaces the stock brand of a tab title with the product name (D91). The stock title is `Page • Brand`, or the bare
 * brand before the first page resolves; any other title is left alone, so applying this twice changes nothing more.
 */
export function brandedTitle(title: string, productName: string): string {
  if (title === STOCK_TITLE_BRAND) return productName;
  const suffix = `${TITLE_SEPARATOR}${STOCK_TITLE_BRAND}`;
  return title.endsWith(suffix) ? `${title.slice(0, -STOCK_TITLE_BRAND.length)}${productName}` : title;
}
