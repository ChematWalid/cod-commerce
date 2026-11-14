import { OPTION_VALUE_SEPARATOR, SKU_MAX, SKU_SUFFIX_SEPARATOR, VARIANT_NAME_SEPARATOR } from '@cod/shared';
import { FIRST_SKU_NUMBER } from './constants';
import { InvalidCatalogInputError } from './errors';

/** The name of a variant: `"<Product> - <v1> / <v2>"`, or the product name alone without option values (D2124). */
export function variantName(productName: string, optionValues: readonly string[]): string {
  if (optionValues.length === 0) {
    return productName;
  }
  return `${productName}${VARIANT_NAME_SEPARATOR}${optionValues.join(OPTION_VALUE_SEPARATOR)}`;
}

/**
 * The next `count` variant SKUs `<baseSku>-n`, counting from 1 and skipping every SKU in `taken` (those of live
 * variants), so a new variant never shares a SKU with a live one. A product without SKU gives empty SKUs.
 *
 * @throws {InvalidCatalogInputError} when a generated SKU would be longer than `SKU_MAX`, so the domain never
 * writes a SKU the API would refuse as input.
 */
export function skuSequence(baseSku: string | null, taken: ReadonlySet<string>, count: number): string[] {
  if (baseSku === null) {
    return Array.from({ length: count }, () => '');
  }
  const skus: string[] = [];
  for (let number = FIRST_SKU_NUMBER; skus.length < count; number += 1) {
    const sku = `${baseSku}${SKU_SUFFIX_SEPARATOR}${String(number)}`;
    if (sku.length > SKU_MAX) {
      throw new InvalidCatalogInputError();
    }
    if (!taken.has(sku)) {
      skus.push(sku);
    }
  }
  return skus;
}
