import {
  CATALOG_PRODUCT_QUERY_KEY,
  CATALOG_PRODUCTS_QUERY_KEY,
  INT_COLUMN_MAX,
  PACK_MAX_COMPONENTS,
  PACK_MAX_PERCENT_DISCOUNT,
  PACK_MIN_COMPONENTS,
  type PackDiscountType,
  type PackPricingMode,
  type PackVariantMode,
  type PackWeightMode,
} from '@cod/shared';

/** A component line as the block edits it; the title is shown only, the server reads the ids. */
export interface PackComponentDraft {
  readonly productId: string;
  readonly title: string;
  readonly variantId: string | null;
  readonly quantity: number;
}

/** The discount choice of a summed pack: none, or one of the shared discount types. */
export type PackDiscountChoice = PackDiscountType | 'none';

/** The pack block's form: modes as chosen, amounts as typed (whole DZD and grams). */
export interface PackForm {
  readonly pricingMode: PackPricingMode;
  readonly fixedPrice: string;
  readonly discountType: PackDiscountChoice;
  readonly discountValue: string;
  readonly variantMode: PackVariantMode;
  readonly sharedOption: string;
  readonly weightMode: PackWeightMode;
  readonly fixedWeight: string;
  readonly components: readonly PackComponentDraft[];
}

/** A component line of `saveCatalogPack` / `previewCatalogPack`. */
export interface PackComponentInput {
  readonly productId: string;
  readonly variantId: string | null;
  readonly quantity: number;
}

/** `CatalogPackInput` of the pack API (D2202); a stored `CatalogPack` holds the same fields. */
export interface PackInput {
  readonly packPricingMode: PackPricingMode;
  readonly packFixedPrice: number | null;
  readonly packDiscountType: PackDiscountType | null;
  readonly packDiscountValue: number | null;
  readonly packVariantMode: PackVariantMode;
  readonly packSharedOption: string | null;
  readonly packWeightMode: PackWeightMode;
  readonly packFixedWeightGrams: number | null;
  readonly components: readonly PackComponentInput[];
}

/** The fields the block may show disabled. */
export type PackFormField =
  'fixedPrice' | 'discountType' | 'discountValue' | 'sharedOption' | 'fixedWeight' | 'componentVariant';

/** The fields a refusal is shown under. */
export type PackFormErrors = Partial<
  Record<'components' | 'fixedPrice' | 'discountValue' | 'sharedOption' | 'fixedWeight', string>
>;

export const TOO_FEW_COMPONENTS_MESSAGE_ID = 'packs.error-too-few-components';
export const TOO_MANY_COMPONENTS_MESSAGE_ID = 'packs.error-too-many-components';
export const AMOUNT_MESSAGE_ID = 'packs.error-amount';
export const DISCOUNT_MESSAGE_ID = 'packs.error-discount';
export const SHARED_OPTION_MESSAGE_ID = 'packs.error-shared-option';

/**
 * The product caches a pack save changes (the pack product's price, weight and variants): catalog's editor and list
 * keys from `@cod/shared`, never catalog's dashboard files (D2201 b).
 */
export const PACK_SAVE_INVALIDATES = [CATALOG_PRODUCT_QUERY_KEY, CATALOG_PRODUCTS_QUERY_KEY] as const;

const WHOLE_NUMBER = /^[0-9]+$/;

/** A typed whole number that an `integer` column holds. */
const isAmount = (text: string): boolean => WHOLE_NUMBER.test(text.trim()) && Number(text.trim()) <= INT_COLUMN_MAX;

const amountOf = (text: string): number => Number(text.trim());

/** A new pack: summed price without discount, one default variant, summed weight, no component yet. */
export function emptyPackForm(): PackForm {
  return {
    pricingMode: 'components_sum',
    fixedPrice: '',
    discountType: 'none',
    discountValue: '',
    variantMode: 'per_component',
    sharedOption: '',
    weightMode: 'components_sum',
    fixedWeight: '',
    components: [],
  };
}

const textOf = (value: number | null): string => (value === null ? '' : String(value));

/** The form of a stored pack; a component's title comes from `titles`, its id when the block has not loaded it. */
export function packFormOf(pack: PackInput, titles: ReadonlyMap<string, string>): PackForm {
  return {
    pricingMode: pack.packPricingMode,
    fixedPrice: textOf(pack.packFixedPrice),
    discountType: pack.packDiscountType ?? 'none',
    discountValue: textOf(pack.packDiscountValue),
    variantMode: pack.packVariantMode,
    sharedOption: pack.packSharedOption ?? '',
    weightMode: pack.packWeightMode,
    fixedWeight: textOf(pack.packFixedWeightGrams),
    components: pack.components.map((line) => ({ ...line, title: titles.get(line.productId) ?? line.productId })),
  };
}

const hasDiscount = (form: PackForm): boolean => form.pricingMode === 'components_sum' && form.discountType !== 'none';

/**
 * The API input of a valid form: only the fields its modes use, so a fixed price never travels with a discount and a
 * shared-option pack pins no variant (the server refuses both).
 */
export function packInputOf(form: PackForm): PackInput {
  const shared = form.variantMode === 'shared_option';
  return {
    packPricingMode: form.pricingMode,
    packFixedPrice: form.pricingMode === 'fixed' ? amountOf(form.fixedPrice) : null,
    packDiscountType: hasDiscount(form) && form.discountType !== 'none' ? form.discountType : null,
    packDiscountValue: hasDiscount(form) ? amountOf(form.discountValue) : null,
    packVariantMode: form.variantMode,
    packSharedOption: shared ? form.sharedOption.trim() : null,
    packWeightMode: form.weightMode,
    packFixedWeightGrams: form.weightMode === 'fixed' ? amountOf(form.fixedWeight) : null,
    components: form.components.map(({ productId, variantId, quantity }) => ({
      productId,
      variantId: shared ? null : variantId,
      quantity,
    })),
  };
}

function componentsError(form: PackForm): string | undefined {
  if (form.components.length < PACK_MIN_COMPONENTS) return TOO_FEW_COMPONENTS_MESSAGE_ID;
  return form.components.length > PACK_MAX_COMPONENTS ? TOO_MANY_COMPONENTS_MESSAGE_ID : undefined;
}

function discountError(form: PackForm): string | undefined {
  if (!hasDiscount(form)) return undefined;
  if (!isAmount(form.discountValue)) return DISCOUNT_MESSAGE_ID;
  const tooHigh = form.discountType === 'percent' && amountOf(form.discountValue) > PACK_MAX_PERCENT_DISCOUNT;
  return tooHigh ? DISCOUNT_MESSAGE_ID : undefined;
}

/**
 * What stops a save before a request: 2 to 10 components, the amounts the chosen modes need, a shared option name.
 * The server checks everything again (ADR 0017).
 */
export function packFormErrors(form: PackForm): PackFormErrors {
  const errors: Record<string, string | undefined> = {
    components: componentsError(form),
    fixedPrice: form.pricingMode === 'fixed' && !isAmount(form.fixedPrice) ? AMOUNT_MESSAGE_ID : undefined,
    discountValue: discountError(form),
    sharedOption:
      form.variantMode === 'shared_option' && form.sharedOption.trim() === '' ? SHARED_OPTION_MESSAGE_ID : undefined,
    fixedWeight: form.weightMode === 'fixed' && !isAmount(form.fixedWeight) ? AMOUNT_MESSAGE_ID : undefined,
  };
  return Object.fromEntries(Object.entries(errors).filter(([, id]) => id !== undefined));
}

/** Whether each field is unused by the form's modes. */
const UNUSED_BY_MODE: Readonly<Record<PackFormField, (form: PackForm) => boolean>> = {
  fixedPrice: (form) => form.pricingMode !== 'fixed',
  discountType: (form) => form.pricingMode === 'fixed',
  discountValue: (form) => !hasDiscount(form),
  sharedOption: (form) => form.variantMode !== 'shared_option',
  fixedWeight: (form) => form.weightMode !== 'fixed',
  componentVariant: (form) => form.variantMode === 'shared_option',
};

/** Whether `field` is disabled: for a caller who may not save, or because the chosen modes do not use it. */
export const packFieldDisabled = (form: PackForm, field: PackFormField, disabled: boolean): boolean =>
  disabled || UNUSED_BY_MODE[field](form);
