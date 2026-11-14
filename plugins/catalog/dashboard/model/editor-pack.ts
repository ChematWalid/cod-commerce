import type { ProductType } from '@cod/shared';
import type { EditorForm } from './editor-form';

/** The product type whose values catalog-packs computes. */
const PACK_TYPE: ProductType = 'pack';

/** Whether the form is of a pack, whose prices, weight and variant matrix catalog-packs computes (D2203, D2227). */
export const isPackForm = (form: Pick<EditorForm, 'type'>): boolean => form.type === PACK_TYPE;

/** Whether the pricing card is read-only: for a caller who may not save, and always for a pack (D2201 c). */
export const pricingReadOnly = (form: Pick<EditorForm, 'type'>, disabled: boolean): boolean =>
  disabled || isPackForm(form);

/** The fields of a product save a pack never sends: catalog-packs computes them (D2227). */
const PACK_COMPUTED_FIELDS = ['price', 'oldPrice', 'weight', 'optionGroups'] as const;

type PackComputedField = (typeof PACK_COMPUTED_FIELDS)[number];

/** `fields` without the price, old price, weight and options, which a pack's editor save leaves to catalog-packs. */
export function withoutPackComputed<T extends object>(fields: T): Omit<T, PackComputedField> {
  const computed = new Set<string>(PACK_COMPUTED_FIELDS);
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !computed.has(key))) as Omit<T, PackComputedField>;
}
