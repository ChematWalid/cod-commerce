import { PACK_MAX_COMPONENTS, PACK_MAX_QUANTITY, PRODUCT_TYPES } from '@cod/shared';
import type { PackComponentDraft, PackForm } from './pack-form';

/** A variant a component line may pin. */
export interface PickableVariant {
  readonly id: string;
  readonly name: string;
}

/** A product of the store as the component picker lists it. */
export interface PickableProduct {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly variants: readonly PickableVariant[];
}

/** The product type whose products cannot be components: packs do not nest (D2202). */
const PACK_TYPE: (typeof PRODUCT_TYPES)[number] = 'pack';

/** The products the picker offers: no pack (this one included) and none already in the pack. */
export function pickableProducts(
  products: readonly PickableProduct[],
  packProductId: string,
  form: PackForm,
): readonly PickableProduct[] {
  const chosen = new Set(form.components.map((line) => line.productId));
  return products.filter(
    (product) => product.type !== PACK_TYPE && product.id !== packProductId && !chosen.has(product.id),
  );
}

/** The form with `product` as one more line (quantity 1, no pinned variant), unless it is in or the pack is full. */
export function withComponent(form: PackForm, product: Pick<PickableProduct, 'id' | 'title'>): PackForm {
  const present = form.components.some((line) => line.productId === product.id);
  if (present || form.components.length >= PACK_MAX_COMPONENTS) return form;
  const line: PackComponentDraft = { productId: product.id, title: product.title, variantId: null, quantity: 1 };
  return { ...form, components: [...form.components, line] };
}

/** The form without the line at `index`. */
export const withoutComponent = (form: PackForm, index: number): PackForm => ({
  ...form,
  components: form.components.filter((_, at) => at !== index),
});

/** The form with the line at `index` given another pinned variant or quantity. */
export const withComponentChange = (
  form: PackForm,
  index: number,
  change: Partial<Pick<PackComponentDraft, 'variantId' | 'quantity'>>,
): PackForm => ({
  ...form,
  components: form.components.map((line, at) => (at === index ? { ...line, ...change } : line)),
});

/** What a component line's variant select shows and allows. */
export interface VariantChoice {
  /** The pinned variant, when the product still has it. */
  readonly pinned: PickableVariant | undefined;
  /** The line pins a variant the product no longer has (deleted since): the server refuses it until it is cleared. */
  readonly pinGone: boolean;
  readonly locked: boolean;
}

/**
 * The variant choice of `line`: a product with one variant offers nothing to choose, except when the line pins a dead
 * variant, which must stay clearable (D2248). An unread product (`undefined`) is never called dead.
 */
export function variantChoiceOf(
  line: PackComponentDraft,
  product: PickableProduct | undefined,
  fieldDisabled: boolean,
): VariantChoice {
  const variants = product?.variants ?? [];
  const pinned = variants.find((variant) => variant.id === line.variantId);
  const pinGone = product !== undefined && line.variantId !== null && pinned === undefined;
  return { pinned, pinGone, locked: fieldDisabled || (!pinGone && variants.length < 2) };
}

/**
 * A typed quantity as a whole number, at most what one line holds; `undefined` while the field is empty or holds no
 * count, so the merchant can clear the field and type another number (the line keeps its last count meanwhile).
 */
export function typedQuantity(text: string): number | undefined {
  const value = Number.parseInt(text, 10);
  if (!Number.isFinite(value) || value < 1) return undefined;
  return Math.min(value, PACK_MAX_QUANTITY);
}
