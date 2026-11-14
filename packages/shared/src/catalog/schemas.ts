import { z } from 'zod';
import { hasControlCharacter } from '../text/control-characters';
import {
  BARCODE_MAX,
  BRAND_NAME_MAX,
  CARD_CAPTION_MAX,
  CUSTOM_ATTRIBUTE_NAME_MAX,
  CUSTOM_ATTRIBUTE_VALUE_MAX,
  DESCRIPTION_MAX,
  HIGHLIGHT_TEXT_MAX,
  LABEL_MAX,
  MAX_CUSTOM_ATTRIBUTES,
  MAX_OPTION_GROUPS,
  MAX_OPTION_VALUES,
  MAX_ORDER_MANAGERS,
  MAX_PRODUCT_ASSETS,
  MAX_PRODUCT_COLLECTIONS,
  MAX_PRODUCT_HIGHLIGHTS,
  MAX_PRODUCT_TAGS,
  MAX_VARIANTS,
  META_DESCRIPTION_MAX,
  META_TITLE_MAX,
  NAME_IN_DELIVERY_MAX,
  OPTION_NAME_MAX,
  OPTION_VALUE_MAX,
  PRODUCT_STATUSES,
  PRODUCT_TITLE_MAX,
  PRODUCT_TYPES,
  QUANTITY_RULE_MAX,
  SKU_MAX,
  SLUG_MAX,
  TAG_NAME_MAX,
} from './constants';
import { CATALOG_ERROR_CODES } from './error-codes';
import {
  catalogRefIdListSchema,
  catalogRefIdSchema,
  catalogNameKey,
  catalogObject,
  catalogTextSchema,
  hasNoRepeatedId,
  intColumnSchema,
  invalidCatalogInput,
  snowflakeListSchema,
} from './fields';
import { moneySchema } from './money';

const matrixTooLarge = { message: CATALOG_ERROR_CODES.MATRIX_TOO_LARGE };
const tooManyHighlights = { message: CATALOG_ERROR_CODES.TOO_MANY_HIGHLIGHTS };

/** A product description as HTML, multi-line; it is sanitised server-side before it is stored (D2122). */
const descriptionSchema = z
  .string(invalidCatalogInput)
  .max(DESCRIPTION_MAX, invalidCatalogInput)
  .refine((value) => !hasControlCharacter(value, { allowLineBreaks: true }), invalidCatalogInput);

const quantityRuleSchema = z
  .number(invalidCatalogInput)
  .int(invalidCatalogInput)
  .min(1, invalidCatalogInput)
  .max(QUANTITY_RULE_MAX, invalidCatalogInput);

/** Quantities a buyer may order: `min`, `min + step`, `min + 2·step`… when enabled. */
export const quantityRulesSchema = catalogObject({
  enabled: z.boolean(invalidCatalogInput),
  min: quantityRuleSchema,
  step: quantityRuleSchema,
});

const customAttributeSchema = catalogObject({
  name: catalogTextSchema(CUSTOM_ATTRIBUTE_NAME_MAX),
  value: catalogTextSchema(CUSTOM_ATTRIBUTE_VALUE_MAX),
});

/**
 * Custom attribute names are unique in a product whatever their case or Unicode form, with the key rule of brand and
 * tag names (D2140): an NFC and an NFD "Café" are one name.
 */
const customAttributeListSchema = z
  .array(customAttributeSchema, invalidCatalogInput)
  .max(MAX_CUSTOM_ATTRIBUTES, invalidCatalogInput)
  .refine(
    (attributes) => new Set(attributes.map(({ name }) => catalogNameKey(name))).size === attributes.length,
    invalidCatalogInput,
  );

const productSettingsFields = {
  nameInDelivery: catalogTextSchema(NAME_IN_DELIVERY_MAX).nullish(),
  isFragile: z.boolean(invalidCatalogInput),
  allowParcelOpening: z.boolean(invalidCatalogInput),
  allowOutOfStockOrders: z.boolean(invalidCatalogInput),
  soldOut: z.boolean(invalidCatalogInput),
  quantityRules: quantityRulesSchema,
  orderManagerIds: snowflakeListSchema(MAX_ORDER_MANAGERS),
  customAttributes: customAttributeListSchema,
};

/** The merchant-only settings of a product in its store (AC5); order managers are team-member ids (D2114). */
export const productSettingsSchema = catalogObject({
  ...productSettingsFields,
  orderManagerIds: productSettingsFields.orderManagerIds.default([]),
  customAttributes: productSettingsFields.customAttributes.default([]),
});

/**
 * A change to the settings of an existing product: an absent key, including one of `quantityRules`, stays unchanged
 * and nothing is defaulted, so a patch of one boolean never clears the order managers or custom attributes. A list
 * that is sent replaces the stored one (`[]` clears it).
 */
export const productSettingsPatchSchema = catalogObject({
  ...productSettingsFields,
  quantityRules: quantityRulesSchema.partial(),
}).partial();

export type ProductSettingsPatchCommand = z.output<typeof productSettingsPatchSchema>;
export type ProductSettingsInput = z.input<typeof productSettingsSchema>;
export type ProductSettingsCommand = z.output<typeof productSettingsSchema>;

/** One option of the variant matrix, such as Color (Red, Blue). Duplicates are the domain's to refuse (Task 9). */
export const optionGroupInputSchema = catalogObject({
  name: catalogTextSchema(OPTION_NAME_MAX),
  values: z
    .array(catalogTextSchema(OPTION_VALUE_MAX), invalidCatalogInput)
    .min(1, invalidCatalogInput)
    .max(MAX_OPTION_VALUES, matrixTooLarge),
});

const seoSchema = catalogObject({
  metaTitle: catalogTextSchema(META_TITLE_MAX).nullish(),
  metaDescription: catalogTextSchema(META_DESCRIPTION_MAX).nullish(),
});

/** Every field of a product; a create fills the lists and the type, a patch takes any of them. */
const productFields = {
  title: catalogTextSchema(PRODUCT_TITLE_MAX),
  slug: catalogTextSchema(SLUG_MAX).optional(),
  description: descriptionSchema.nullish(),
  status: z.enum(PRODUCT_STATUSES, invalidCatalogInput),
  type: z.enum(PRODUCT_TYPES, invalidCatalogInput),
  price: moneySchema,
  oldPrice: moneySchema.nullish(),
  sku: catalogTextSchema(SKU_MAX).nullish(),
  barcode: catalogTextSchema(BARCODE_MAX).nullish(),
  weight: intColumnSchema.nullish(),
  width: intColumnSchema.nullish(),
  height: intColumnSchema.nullish(),
  length: intColumnSchema.nullish(),
  featuredAssetId: catalogRefIdSchema.nullish(),
  assetIds: catalogRefIdListSchema(MAX_PRODUCT_ASSETS),
  brandId: catalogRefIdSchema.nullish(),
  tagIds: catalogRefIdListSchema(MAX_PRODUCT_TAGS),
  highlightIds: catalogRefIdListSchema(MAX_PRODUCT_HIGHLIGHTS, tooManyHighlights),
  collectionIds: catalogRefIdListSchema(MAX_PRODUCT_COLLECTIONS),
  label: catalogTextSchema(LABEL_MAX).nullish(),
  cardCaption: catalogTextSchema(CARD_CAPTION_MAX).nullish(),
  seo: seoSchema,
  optionGroups: z.array(optionGroupInputSchema, invalidCatalogInput).max(MAX_OPTION_GROUPS, matrixTooLarge),
  settings: productSettingsSchema,
};

/**
 * "Create a product". Without options the price, old price, SKU and barcode are the default variant's; with options
 * they are the defaults of new variants (D2124). Strings are written in the store's language (D2112).
 */
export const productInputSchema = catalogObject({
  ...productFields,
  type: productFields.type.default('physical'),
  assetIds: productFields.assetIds.default([]),
  tagIds: productFields.tagIds.default([]),
  highlightIds: productFields.highlightIds.default([]),
  collectionIds: productFields.collectionIds.default([]),
  seo: productFields.seo.optional(),
  optionGroups: productFields.optionGroups.default([]),
  settings: productFields.settings.optional(),
});

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductCommand = z.output<typeof productInputSchema>;

/** A change to one existing variant of the product; `null` clears an optional field. */
export const variantPatchSchema = catalogObject({
  id: catalogRefIdSchema,
  price: moneySchema.optional(),
  oldPrice: moneySchema.nullish(),
  sku: catalogTextSchema(SKU_MAX).nullish(),
  barcode: catalogTextSchema(BARCODE_MAX).nullish(),
  isHidden: z.boolean(invalidCatalogInput).optional(),
  featuredAssetId: catalogRefIdSchema.nullish(),
});

/**
 * "Edit a product": any field of {@link productInputSchema}, plus edits to existing variants (each at most once);
 * an absent field stays unchanged, `null` clears, and `settings` follows {@link productSettingsPatchSchema}.
 */
export const productPatchSchema = catalogObject(productFields)
  .partial()
  .extend({
    settings: productSettingsPatchSchema.optional(),
    variants: z
      .array(variantPatchSchema, invalidCatalogInput)
      .max(MAX_VARIANTS, invalidCatalogInput)
      .refine((variants) => hasNoRepeatedId(variants.map(({ id }) => id)), invalidCatalogInput)
      .optional(),
  });

export type ProductPatchInput = z.input<typeof productPatchSchema>;
export type ProductPatchCommand = z.output<typeof productPatchSchema>;
export type VariantPatchCommand = z.output<typeof variantPatchSchema>;

/** "Add a brand" or "rename a brand"; the name is unique in its store whatever its case (D2140). */
export const brandInputSchema = catalogObject({ name: catalogTextSchema(BRAND_NAME_MAX) });
/** "Add a tag" or "rename a tag"; the name is unique in its store whatever its case (D2140). */
export const tagInputSchema = catalogObject({ name: catalogTextSchema(TAG_NAME_MAX) });
/** "Add a highlight": a short selling point a product can show, at most six per product. */
export const highlightInputSchema = catalogObject({ text: catalogTextSchema(HIGHLIGHT_TEXT_MAX) });

export type BrandCommand = z.output<typeof brandInputSchema>;
export type TagCommand = z.output<typeof tagInputSchema>;
export type HighlightCommand = z.output<typeof highlightInputSchema>;
