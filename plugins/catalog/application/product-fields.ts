import type { ProductCommand, ProductPatchCommand } from '@cod/shared';
import type { DescriptionSanitizerPort } from '../domain/ports/description-sanitizer.port';
import type { ProductFields, ProductRecord } from '../domain/product';
import { ProductTitle } from '../domain/product-title';
import { Slug } from '../domain/slug';
import type { CheckedReferences } from './product-references';

/** The fields a body may send, other than the ids and the nested SEO, which are read apart. */
const PLAIN_FIELDS = [
  'status',
  'type',
  'price',
  'oldPrice',
  'sku',
  'barcode',
  'weight',
  'width',
  'height',
  'length',
  'label',
  'cardCaption',
] as const;

type PlainField = (typeof PLAIN_FIELDS)[number];

/** `value`, or `fallback` when it was not sent; `null` stays `null` (it clears). */
const sentOr = <T>(value: T | undefined, fallback: T): T => (value === undefined ? fallback : value);

/** The description sanitised (D2122); a blank result is no description. */
function cleanDescription(raw: string | null | undefined, sanitizer: DescriptionSanitizerPort): string | null {
  if (raw === undefined || raw === null) return null;
  const clean = sanitizer.sanitize(raw).trim();
  return clean === '' ? null : clean;
}

/** The plain fields of `source` after `patch`: an absent key keeps the source's value. */
function plainFieldsAfter(source: Pick<ProductFields, PlainField>, patch: Partial<Record<PlainField, unknown>>) {
  const entries = PLAIN_FIELDS.map((key) => [key, sentOr(patch[key], source[key])] as const);
  return Object.fromEntries(entries) as Pick<ProductFields, PlainField>;
}

const BLANK_PLAIN: Pick<ProductFields, PlainField> = {
  status: 'draft',
  type: 'physical',
  price: 0,
  oldPrice: null,
  sku: null,
  barcode: null,
  weight: null,
  width: null,
  height: null,
  length: null,
  label: null,
  cardCaption: null,
};

/** The fields of a new product from its validated body and checked ids. */
export function fieldsOfCommand(
  command: ProductCommand,
  refs: CheckedReferences,
  sanitizer: DescriptionSanitizerPort,
): ProductFields {
  return {
    ...plainFieldsAfter(BLANK_PLAIN, command),
    title: ProductTitle.create(command.title).value,
    description: cleanDescription(command.description, sanitizer),
    featuredAssetId: refs.featuredAssetId ?? null,
    assetIds: refs.assetIds ?? [],
    brandId: refs.brandId ?? null,
    metaTitle: command.seo?.metaTitle ?? null,
    metaDescription: command.seo?.metaDescription ?? null,
  };
}

/** The fields of `record` after `patch`: an absent field stays, `null` clears (D2124). */
export function fieldsAfterPatch(
  record: ProductRecord,
  patch: ProductPatchCommand,
  refs: CheckedReferences,
  sanitizer: DescriptionSanitizerPort,
): ProductFields {
  const description =
    patch.description === undefined ? record.description : cleanDescription(patch.description, sanitizer);
  return {
    ...plainFieldsAfter(record, patch),
    title: patch.title === undefined ? record.title : ProductTitle.create(patch.title).value,
    description,
    featuredAssetId: sentOr(refs.featuredAssetId, record.featuredAssetId),
    assetIds: sentOr(refs.assetIds, record.assetIds),
    brandId: sentOr(refs.brandId, record.brandId),
    // Each SEO field follows the patch rule on its own: absent keeps, null clears.
    metaTitle: sentOr(patch.seo?.metaTitle, record.metaTitle),
    metaDescription: sentOr(patch.seo?.metaDescription, record.metaDescription),
  };
}

/** The slug a body asks for, validated; `null` when none was sent. */
export const slugOf = (raw: string | undefined): string | null => (raw === undefined ? null : Slug.create(raw).value);
