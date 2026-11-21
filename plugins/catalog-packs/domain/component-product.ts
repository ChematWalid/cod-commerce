import type { ProductStatus, ProductType } from '@cod/shared';

/** One option of a product, its values in display order. */
export interface ComponentOptionGroup {
  readonly name: string;
  readonly values: readonly string[];
}

/** A live variant of a product as pricing reads it. */
export interface ComponentVariant {
  readonly id: string;
  readonly price: number;
  /** Its option values in group order; empty for the default variant of a product without options. */
  readonly optionValues: readonly string[];
}

/** A product of the store as a pack reads it: a component, or the pack product itself. */
export interface ComponentProduct {
  readonly id: string;
  readonly type: ProductType;
  readonly status: ProductStatus;
  readonly price: number;
  /** Grams; a product without a weight counts as 0 in a summed pack weight. */
  readonly weight: number | null;
  readonly optionGroups: readonly ComponentOptionGroup[];
  readonly variants: readonly ComponentVariant[];
}
