import { catalogNameKey, type ProductStatus } from '@cod/shared';
import { type EditorForm, type SettingsDraft, type VariantDraft, wholeNumberOf } from './editor-form';
import { type OptionDraft, type OptionsDraft, resetsVariants } from './options-draft';

/** The product fields of a create or an update, as the catalog API takes them (`CreateCatalogProductInput`). */
export interface ProductFieldsInput {
  readonly title: string;
  readonly slug?: string;
  readonly description: string | null;
  readonly status: ProductStatus;
  readonly price: number;
  readonly oldPrice: number | null;
  readonly sku: string | null;
  readonly barcode: string | null;
  readonly weight: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly length: number | null;
  readonly featuredAssetId: string | null;
  readonly assetIds: readonly string[];
  readonly brandId: string | null;
  readonly tagIds: readonly string[];
  readonly highlightIds: readonly string[];
  readonly collectionIds: readonly string[];
  readonly label: string | null;
  readonly cardCaption: string | null;
  readonly seo: { readonly metaTitle: string | null; readonly metaDescription: string | null };
  readonly optionGroups: readonly OptionDraft[];
}

export interface SettingsInput {
  readonly nameInDelivery: string | null;
  readonly isFragile: boolean;
  readonly allowParcelOpening: boolean;
  readonly allowOutOfStockOrders: boolean;
  readonly soldOut: boolean;
  readonly quantityRules: { readonly enabled: boolean; readonly min: number; readonly step: number };
  readonly orderManagerIds: readonly string[];
}

/** An edit to one live variant, by id (`CatalogVariantInput`). */
export interface VariantPatchInput {
  readonly id: string;
  readonly sku?: string | null;
  readonly price?: number;
  readonly isHidden?: boolean;
  readonly featuredAssetId?: string | null;
}

export type CreateProductInput = ProductFieldsInput & { readonly settings: SettingsInput };

/** `UpdateCatalogProductInput`: only what changed; an absent field stays, `null` clears. */
export type ProductPatchInput = Partial<ProductFieldsInput> & {
  readonly settings?: Partial<SettingsInput>;
  readonly variants?: readonly VariantPatchInput[];
};

/** Free text as the API takes it: an empty field is `null`. */
const textOrNull = (text: string): string | null => (text.trim() === '' ? null : text);
const MARKUP_TAG = /<[^>]*>/g;
const NO_BREAK_SPACE_ENTITY = /&nbsp;/g;
/**
 * Rich text as the API takes it: the rich-text editor leaves `<p></p>` when every word is deleted, which is no
 * description, so markup without text is `null` too.
 */
const richTextOrNull = (html: string): string | null =>
  html.replace(MARKUP_TAG, '').replace(NO_BREAK_SPACE_ENTITY, ' ').trim() === '' ? null : html;
/** A number field the form already checked (`editorFormErrors`). */
const numberOrNull = (text: string): number | null => wholeNumberOf(text) ?? null;
const RULE_FALLBACK = 1;

function fieldsOf(form: EditorForm): ProductFieldsInput {
  const slug = form.slug.trim();
  return {
    title: form.title.trim(),
    ...(slug === '' ? {} : { slug }),
    description: richTextOrNull(form.description),
    status: form.status,
    price: numberOrNull(form.price) ?? 0,
    oldPrice: numberOrNull(form.oldPrice),
    weight: numberOrNull(form.weight),
    width: numberOrNull(form.width),
    height: numberOrNull(form.height),
    length: numberOrNull(form.length),
    sku: textOrNull(form.sku),
    barcode: textOrNull(form.barcode),
    featuredAssetId: form.featuredAssetId,
    assetIds: form.assetIds,
    brandId: form.brandId,
    tagIds: form.tagIds,
    highlightIds: form.highlightIds,
    collectionIds: form.collectionIds,
    label: textOrNull(form.label),
    cardCaption: textOrNull(form.cardCaption),
    seo: { metaTitle: textOrNull(form.metaTitle), metaDescription: textOrNull(form.metaDescription) },
    optionGroups: form.options,
  };
}

const settingsOf = (settings: SettingsDraft): SettingsInput => ({
  nameInDelivery: textOrNull(settings.nameInDelivery),
  isFragile: settings.isFragile,
  allowParcelOpening: settings.allowParcelOpening,
  allowOutOfStockOrders: settings.allowOutOfStockOrders,
  soldOut: settings.soldOut,
  quantityRules: {
    enabled: settings.quantityEnabled,
    min: numberOrNull(settings.quantityMin) ?? RULE_FALLBACK,
    step: numberOrNull(settings.quantityStep) ?? RULE_FALLBACK,
  },
  orderManagerIds: settings.orderManagerIds,
});

/** "Create a product" from the form: every field, the options and the full settings. */
export const createInputOf = (form: EditorForm): CreateProductInput => ({
  ...fieldsOf(form),
  settings: settingsOf(form.settings),
});

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The entries of `next` that differ from `saved`, leaving out those that end up absent. */
function changedEntries<T extends object>(saved: T, next: T): Partial<T> {
  const before = saved as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => value !== undefined && !same(value, before[key])),
  ) as Partial<T>;
}

const variantFieldsOf = (row: VariantDraft) => ({
  sku: textOrNull(row.sku),
  price: numberOrNull(row.price) ?? 0,
  isHidden: row.isHidden,
  featuredAssetId: row.featuredAssetId,
});

/** Whether the variant's combination is still in the options, so the server keeps it and its edit applies. */
const isKept = (row: VariantDraft, options: OptionsDraft): boolean =>
  row.optionValues.every((value, index) =>
    (options[index]?.values ?? []).some((kept) => catalogNameKey(kept) === catalogNameKey(value)),
  );

/** The edits of variants the save keeps, each with only its changed fields. */
function variantPatchesOf(saved: EditorForm, form: EditorForm): VariantPatchInput[] {
  if (resetsVariants(saved.options, form.options)) return [];
  const before = new Map(saved.variants.map((row) => [row.id, variantFieldsOf(row)]));
  return form.variants.flatMap((row) => {
    const original = before.get(row.id);
    if (original === undefined || !isKept(row, form.options)) return [];
    const changed = changedEntries(original, variantFieldsOf(row));
    return Object.keys(changed).length === 0 ? [] : [{ id: row.id, ...changed }];
  });
}

/** "Edit a product": the fields, settings and variant edits that differ from what was saved. */
export function patchOf(saved: EditorForm, form: EditorForm): ProductPatchInput {
  const fields = changedEntries(fieldsOf(saved), fieldsOf(form));
  const settings = changedEntries(settingsOf(saved.settings), settingsOf(form.settings));
  const variants = variantPatchesOf(saved, form);
  return {
    ...fields,
    ...(Object.keys(settings).length === 0 ? {} : { settings }),
    ...(variants.length === 0 ? {} : { variants }),
  };
}

export const isEmptyPatch = (patch: ProductPatchInput): boolean => Object.keys(patch).length === 0;
