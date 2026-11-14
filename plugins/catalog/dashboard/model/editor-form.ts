import { CATALOG_ERROR_CODES, INT_COLUMN_MAX, MAX_PRODUCT_HIGHLIGHTS, type ProductStatus } from '@cod/shared';
import type { CatalogProductDto, CatalogVariantDto } from '../dto';
import type { OptionsDraft } from './options-draft';

/** A variant row of the editor: what the variants table edits, numbers as typed. */
export interface VariantDraft {
  readonly id: string;
  readonly optionValues: readonly string[];
  readonly sku: string;
  readonly price: string;
  readonly isHidden: boolean;
  readonly featuredAssetId: string | null;
}

/** The merchant-only settings as the settings card edits them (AC5). */
export interface SettingsDraft {
  readonly nameInDelivery: string;
  readonly isFragile: boolean;
  readonly allowParcelOpening: boolean;
  readonly allowOutOfStockOrders: boolean;
  readonly soldOut: boolean;
  readonly quantityEnabled: boolean;
  readonly quantityMin: string;
  readonly quantityStep: string;
  readonly orderManagerIds: readonly string[];
}

/** Everything the editor edits. Text and numbers are kept as typed (`''` is "none") and parsed on save. */
export interface EditorForm {
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly status: ProductStatus;
  readonly price: string;
  readonly oldPrice: string;
  readonly sku: string;
  readonly barcode: string;
  readonly weight: string;
  readonly width: string;
  readonly height: string;
  readonly length: string;
  readonly featuredAssetId: string | null;
  readonly assetIds: readonly string[];
  readonly brandId: string | null;
  readonly tagIds: readonly string[];
  readonly highlightIds: readonly string[];
  readonly collectionIds: readonly string[];
  readonly label: string;
  readonly cardCaption: string;
  readonly metaTitle: string;
  readonly metaDescription: string;
  readonly options: OptionsDraft;
  readonly variants: readonly VariantDraft[];
  readonly settings: SettingsDraft;
}

export type EditorField = keyof EditorForm;
/** A catalogue id per field the form refuses. */
export type EditorFormErrors = Partial<Record<EditorField, string>>;

export const TITLE_REQUIRED_MESSAGE_ID = 'catalog.error-title-required';
export const WHOLE_NUMBER_MESSAGE_ID = 'catalog.error-whole-number';
export const OPTION_VALUES_REQUIRED_MESSAGE_ID = 'catalog.error-option-values-required';

const WHOLE_NUMBER = /^\d+$/;

/**
 * The whole, non-negative number typed in `text` (money in DZD, grams, centimetres), `null` for an empty field, or
 * `undefined` when the text is no such number (ADR 0004).
 */
export function wholeNumberOf(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!WHOLE_NUMBER.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value <= INT_COLUMN_MAX ? value : undefined;
}

const textOf = (value: string | number | null): string => (value === null ? '' : String(value));

const DEFAULT_SETTINGS: SettingsDraft = {
  nameInDelivery: '',
  isFragile: false,
  allowParcelOpening: true,
  allowOutOfStockOrders: true,
  soldOut: false,
  quantityEnabled: false,
  quantityMin: '1',
  quantityStep: '1',
  orderManagerIds: [],
};

/** An untyped field. A named constant, as the catalogue scan reads a literal `title` value as a message id. */
const NOTHING_TYPED = '';

/** A new product: nothing typed yet, listed once saved. */
export const emptyEditorForm = (): EditorForm => ({
  title: NOTHING_TYPED,
  slug: '',
  description: '',
  status: 'active',
  price: '',
  oldPrice: '',
  sku: '',
  barcode: '',
  weight: '',
  width: '',
  height: '',
  length: '',
  featuredAssetId: null,
  assetIds: [],
  brandId: null,
  tagIds: [],
  highlightIds: [],
  collectionIds: [],
  label: '',
  cardCaption: '',
  metaTitle: '',
  metaDescription: '',
  options: [],
  variants: [],
  settings: DEFAULT_SETTINGS,
});

const variantDraftOf = (variant: CatalogVariantDto): VariantDraft => ({
  id: variant.id,
  optionValues: variant.optionValues,
  sku: variant.sku,
  price: String(variant.price),
  isHidden: variant.isHidden,
  featuredAssetId: variant.featuredAsset?.id ?? null,
});

const settingsDraftOf = ({ settings }: CatalogProductDto): SettingsDraft => ({
  nameInDelivery: textOf(settings.nameInDelivery),
  isFragile: settings.isFragile,
  allowParcelOpening: settings.allowParcelOpening,
  allowOutOfStockOrders: settings.allowOutOfStockOrders,
  soldOut: settings.soldOut,
  quantityEnabled: settings.quantityRules.enabled,
  quantityMin: String(settings.quantityRules.min),
  quantityStep: String(settings.quantityRules.step),
  orderManagerIds: settings.orderManagerIds,
});

/** A saved product as the editor's form; the form the editor compares with to send only what changed. */
export const editorFormOf = (product: CatalogProductDto): EditorForm => ({
  title: product.title,
  slug: product.slug,
  description: textOf(product.description),
  status: product.status,
  price: textOf(product.price),
  oldPrice: textOf(product.oldPrice),
  sku: textOf(product.sku),
  barcode: textOf(product.barcode),
  weight: textOf(product.weight),
  width: textOf(product.width),
  height: textOf(product.height),
  length: textOf(product.length),
  featuredAssetId: product.featuredAsset?.id ?? null,
  assetIds: product.assets.map((asset) => asset.id),
  brandId: product.brandId,
  tagIds: product.tagIds,
  highlightIds: product.highlightIds,
  collectionIds: product.collectionIds,
  label: textOf(product.label),
  cardCaption: textOf(product.cardCaption),
  metaTitle: textOf(product.metaTitle),
  metaDescription: textOf(product.metaDescription),
  options: product.optionGroups.map((group) => ({ name: group.name, values: group.values.map(({ name }) => name) })),
  variants: product.variants.map(variantDraftOf),
  settings: settingsDraftOf(product),
});

/** Number fields of the product: money must be typed, sizes may be empty. */
const OPTIONAL_NUMBER_FIELDS = ['oldPrice', 'weight', 'width', 'height', 'length'] as const;

const isWholeOrEmpty = (text: string): boolean => wholeNumberOf(text) !== undefined;
const isWhole = (text: string): boolean => typeof wholeNumberOf(text) === 'number';

function settingsAreValid({ settings }: EditorForm): boolean {
  if (!settings.quantityEnabled) return true;
  return [settings.quantityMin, settings.quantityStep].every((text) => (wholeNumberOf(text) ?? 0) >= 1);
}

/**
 * What the form refuses before the server is asked (the server checks again): a blank title, money or a size that is
 * not a whole number, an option without values, more than six highlights (AC3), a bad variant price or quantity rule.
 */
export function editorFormErrors(form: EditorForm): EditorFormErrors {
  const checks: readonly [EditorField, boolean, string][] = [
    ['title', form.title.trim() !== '', TITLE_REQUIRED_MESSAGE_ID],
    ['price', isWhole(form.price), WHOLE_NUMBER_MESSAGE_ID],
    ...OPTIONAL_NUMBER_FIELDS.map((key): [EditorField, boolean, string] => [
      key,
      isWholeOrEmpty(form[key]),
      WHOLE_NUMBER_MESSAGE_ID,
    ]),
    ['options', form.options.every((group) => group.values.length > 0), OPTION_VALUES_REQUIRED_MESSAGE_ID],
    ['highlightIds', form.highlightIds.length <= MAX_PRODUCT_HIGHLIGHTS, CATALOG_ERROR_CODES.TOO_MANY_HIGHLIGHTS],
    ['variants', form.variants.every((row) => isWhole(row.price)), WHOLE_NUMBER_MESSAGE_ID],
    ['settings', settingsAreValid(form), WHOLE_NUMBER_MESSAGE_ID],
  ];
  return Object.fromEntries(checks.filter(([, valid]) => !valid).map(([field, , messageId]) => [field, messageId]));
}

/**
 * Whether the saved product has option variants, so the variants table is shown, even for a single combination such
 * as Color: Red. A product without options has one default variant that follows the product's own fields.
 */
export const hasOptionVariants = (form: EditorForm): boolean =>
  form.variants.some((row) => row.optionValues.length > 0);

export type SubmitOutcome<T> =
  { readonly kind: 'invalid'; readonly errors: EditorFormErrors } | { readonly kind: 'sent'; readonly answer: T };

/** Sends the form with `send` only when nothing in it is refused; otherwise answers the refused fields. */
export async function submitEditor<T>(
  form: EditorForm,
  send: (form: EditorForm) => Promise<T>,
): Promise<SubmitOutcome<T>> {
  const errors = editorFormErrors(form);
  if (Object.keys(errors).length > 0) return { kind: 'invalid', errors };
  return { kind: 'sent', answer: await send(form) };
}
