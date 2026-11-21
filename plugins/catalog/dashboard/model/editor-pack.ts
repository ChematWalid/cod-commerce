import type { ProductType } from '@cod/shared';

/** What the pack rules read of the editor's form (not imported from it: the form imports these rules). */
interface TypedForm {
  readonly type: ProductType;
}

/** The product type whose values catalog-packs computes. */
const PACK_TYPE: ProductType = 'pack';

/** Whether the form is of a pack, whose prices, weight and variant matrix catalog-packs computes (D2203, D2227). */
export const isPackForm = (form: TypedForm): boolean => form.type === PACK_TYPE;

/**
 * The form fields catalog-packs computes for a pack (`variants` stands for the variant prices): read-only, unchecked
 * and never sent by the editor (D2227, D2233). SKU and barcode stay the merchant's.
 */
const PACK_COMPUTED_FORM_FIELDS: ReadonlySet<string> = new Set(['price', 'oldPrice', 'weight', 'options', 'variants']);

/** Whether `field` of the form is one catalog-packs computes, which only a pack has. */
export const isPackComputed = (form: TypedForm, field: string): boolean =>
  isPackForm(form) && PACK_COMPUTED_FORM_FIELDS.has(field);

/** Whether `field` is read-only: for a caller who may not save, and for a field catalog-packs computes (D2201 c). */
export const packFieldReadOnly = (form: TypedForm, field: string, disabled: boolean): boolean =>
  disabled || isPackComputed(form, field);

/** The fields of a product save a pack never sends: catalog-packs computes them (D2227). */
const PACK_COMPUTED_FIELDS = ['price', 'oldPrice', 'weight', 'optionGroups'] as const;

type PackComputedField = (typeof PACK_COMPUTED_FIELDS)[number];

/** `fields` without the price, old price, weight and options, which a pack's editor save leaves to catalog-packs. */
export function withoutPackComputed<T extends object>(fields: T): Omit<T, PackComputedField> {
  const computed = new Set<string>(PACK_COMPUTED_FIELDS);
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !computed.has(key))) as Omit<T, PackComputedField>;
}
