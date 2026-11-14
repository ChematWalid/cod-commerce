import type { ProductStatus, ProductType, Snowflake } from '@cod/shared';
import type { ID, LanguageCode, Product, ProductOption, ProductOptionGroup, ProductVariant } from '@vendure/core';
import { type CoreId, toCoreId } from '../domain/core-id';
import type { OptionGroupRecord, ProductRecord, VariantRecord } from '../domain/product';

/** Our custom fields on `Product` (D2100, Task 11 defaults), as stored. */
export interface ProductCustomFields {
  status: ProductStatus;
  type: ProductType;
  oldPrice: number | null;
  defaultPrice: number | null;
  defaultSku: string | null;
  brandId: Snowflake | null;
  weight: number | null;
  width: number | null;
  height: number | null;
  length: number | null;
  label: string | null;
  cardCaption: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
}

/** Our custom fields on `ProductVariant`. */
export interface VariantCustomFields {
  oldPrice: number | null;
  isHidden: boolean;
  barcode: string | null;
}

/** The `position` custom field of option groups and options (D2124). */
interface PositionFields {
  position: number;
}

interface Translation {
  readonly languageCode: LanguageCode;
  readonly name: string;
}

const customOf = <T>(entity: { customFields?: unknown }): Partial<T> => {
  const fields: unknown = entity.customFields ?? {};
  return fields as Partial<T>;
};

/** The brand a product names, as stored; `null` for none. */
export const brandIdOf = (product: Product): Snowflake | null => customOf<ProductCustomFields>(product).brandId ?? null;

/** A relation as read: TypeORM leaves one that was not loaded `undefined`, whatever the entity's type says. */
const loaded = <T>(relation: readonly T[] | undefined): readonly T[] => relation ?? [];

/** A Vendure id as the catalog carries it. */
export const coreIdOf = (id: ID): CoreId => toCoreId(String(id));

/**
 * A core id as Vendure's own entities hold it: the integer of its SERIAL column. Most services accept the string, but
 * core compares some ids strictly (`samplesEach` in the variant option check), where `"3"` is not `3`.
 */
export const engineIdOf = (id: string): number => Number(id);

/**
 * Vendure clears a featured image on `null` (`AssetService.updateFeaturedAsset`), but its generated input types leave
 * `null` out; this keeps the clear without widening the type everywhere.
 */
export const clearableId = (id: CoreId | null): CoreId | undefined => id ?? (null as unknown as undefined);

const optionalCoreId = (id: ID | null | undefined): CoreId | null =>
  id === null || id === undefined ? null : coreIdOf(id);

/** The name in the store's language, else the first translation (D2112: only that language is written). */
export function nameIn(
  entity: { translations?: readonly Translation[]; name?: string },
  language: LanguageCode,
): string {
  const translations = entity.translations ?? [];
  const match = translations.find((translation) => translation.languageCode === language) ?? translations[0];
  return match?.name ?? entity.name ?? '';
}

const byPosition = <T extends { customFields?: unknown; id: ID }>(left: T, right: T): number =>
  (customOf<PositionFields>(left).position ?? 0) - (customOf<PositionFields>(right).position ?? 0) ||
  Number(left.id) - Number(right.id);

const isLive = (entity: { deletedAt?: Date | null }): boolean =>
  entity.deletedAt === null || entity.deletedAt === undefined;

/** The live option groups of a product, in position order, each with its live values in order. */
export function optionGroupsOf(product: Product, language: LanguageCode): OptionGroupRecord[] {
  return [...loaded(product.optionGroups)]
    .filter(isLive)
    .sort(byPosition)
    .map((group: ProductOptionGroup) => ({
      id: coreIdOf(group.id),
      name: nameIn(group, language),
      values: [...loaded(group.options)]
        .filter(isLive)
        .sort(byPosition)
        .map((option: ProductOption) => ({ id: coreIdOf(option.id), name: nameIn(option, language) })),
    }));
}

/** A variant's option values in group order. */
function optionValuesOf(variant: ProductVariant, groups: readonly OptionGroupRecord[]): string[] {
  const optionIds = new Set(loaded(variant.options).map((option) => String(option.id)));
  return groups.flatMap((group) => group.values.filter((value) => optionIds.has(value.id)).map((value) => value.name));
}

/** One live variant as the catalog reads it. */
export function variantOf(
  variant: ProductVariant,
  groups: readonly OptionGroupRecord[],
  language: LanguageCode,
): VariantRecord {
  const custom = customOf<VariantCustomFields>(variant);
  return {
    id: coreIdOf(variant.id),
    name: nameIn(variant, language),
    sku: variant.sku,
    price: variant.price,
    oldPrice: custom.oldPrice ?? null,
    barcode: custom.barcode ?? null,
    isHidden: custom.isHidden ?? false,
    optionValues: optionValuesOf(variant, groups),
    featuredAssetId: optionalCoreId(variant.featuredAssetId),
  };
}

/** The product-level price, SKU and barcode: the default variant's without options, the stored defaults with (D2124). */
function defaultsOf(
  custom: Partial<ProductCustomFields>,
  groups: readonly OptionGroupRecord[],
  variants: readonly VariantRecord[],
) {
  const [only] = variants;
  if (groups.length === 0 && only !== undefined && variants.length === 1) {
    return { price: only.price, sku: only.sku === '' ? null : only.sku, barcode: only.barcode };
  }
  return { price: custom.defaultPrice ?? 0, sku: custom.defaultSku ?? null, barcode: null };
}

/** Our product custom fields that may be empty, each read as `null` when unset. */
const NULLABLE_PRODUCT_FIELDS = [
  'oldPrice',
  'weight',
  'width',
  'height',
  'length',
  'brandId',
  'label',
  'cardCaption',
  'metaTitle',
  'metaDescription',
] as const;

type NullableProductFields = Pick<ProductCustomFields, (typeof NULLABLE_PRODUCT_FIELDS)[number]>;

function nullableFieldsOf(custom: Partial<ProductCustomFields>): NullableProductFields {
  return Object.fromEntries(NULLABLE_PRODUCT_FIELDS.map((key) => [key, custom[key] ?? null])) as NullableProductFields;
}

/** The title, slug and description in the store's language (D2112). */
function textsOf(product: Product, language: LanguageCode) {
  const translation = loaded(product.translations).find((entry) => entry.languageCode === language);
  const description = translation?.description ?? product.description;
  return {
    title: translation?.name ?? product.name,
    slug: translation?.slug ?? product.slug,
    description: description === '' ? null : description,
  };
}

/** A product of Vendure, its live variants already read with their channel price, as the catalog's record. */
export function productRecordOf(
  product: Product,
  variants: readonly ProductVariant[],
  language: LanguageCode,
): ProductRecord {
  const custom = customOf<ProductCustomFields>(product);
  const groups = optionGroupsOf(product, language);
  const variantRecords = variants.filter(isLive).map((variant) => variantOf(variant, groups, language));
  return {
    id: coreIdOf(product.id),
    ...textsOf(product, language),
    status: custom.status ?? 'draft',
    type: custom.type ?? 'physical',
    ...nullableFieldsOf(custom),
    ...defaultsOf(custom, groups, variantRecords),
    featuredAssetId: optionalCoreId(product.featuredAssetId),
    assetIds: [...loaded(product.assets)]
      .sort((left, right) => left.position - right.position)
      .map((asset) => coreIdOf(asset.assetId)),
    optionGroups: groups,
    variants: variantRecords,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
