import type { ProductType } from '@cod/shared';

/** The label of each product type in the editor's type choice (D2201 c). */
export const PRODUCT_TYPE_LABEL_IDS: Readonly<Record<ProductType, string>> = {
  physical: 'catalog.type-physical',
  pack: 'catalog.type-pack',
};

/**
 * Whether the editor offers the Physical / Pack choice: on a new product only. A product never changes type through
 * the editor (D2227), so an existing one shows no choice.
 */
export const showsTypeChoice = (productId: string | null): boolean => productId === null;
