import type { CoreId } from '../domain/core-id';
import type { OptionGroupRecord, VariantRecord } from '../domain/product';
import type { ProductSettingsValues } from '../domain/product-settings';
import type { ProductView } from './product-view';

/** An image as a buyer's page shows it: its asset id and its preview storage path (never a URL, D3209). */
export interface VisibleImage {
  readonly id: CoreId;
  readonly preview: string;
}

/** The preview storage path of each image a page of products shows, read once for the whole page. */
export type ImagePreviews = ReadonlyMap<CoreId, string>;

/** A variant a buyer may pick: its barcode and hidden flag are the merchant's. */
export interface VisibleVariant extends Omit<VariantRecord, 'barcode' | 'isHidden'> {
  /** The preview path of its own image; `null` without one or once the image is gone. */
  readonly featuredAssetPreview: string | null;
}

/** The settings a buyer's page needs; order managers, the delivery name and parcel flags stay with the merchant. */
export type VisibleProductSettings = Pick<ProductSettingsValues, 'quantityRules' | 'customAttributes'>;

/** A product as a public context shows it: whether it is sold out, and whether a buyer may still order it. */
export interface VisibleProduct extends Omit<ProductView, 'barcode' | 'variants' | 'settings'> {
  /**
   * The collections the merchant put this product in by hand, only (D2309). A product an automatic collection's rule
   * matches is not listed here: that membership comes from the collections-rules read, so a storefront building
   * breadcrumbs or "more in this collection" must ask collections-rules, not this field.
   */
  readonly collectionIds: ProductView['collectionIds'];
  /** Only the variants the merchant has not hidden (AC1). */
  readonly variants: readonly VisibleVariant[];
  /** Only the options and values some shown variant uses, in their order (#246). */
  readonly optionGroups: ProductView['optionGroups'];
  /** The featured image with its preview; `null` without one or once the image is gone. */
  readonly featuredAsset: VisibleImage | null;
  /** The gallery images still stored, in gallery order. */
  readonly assets: readonly VisibleImage[];
  readonly settings: VisibleProductSettings;
  readonly soldOut: boolean;
  /** Not sold out, or its orders stay open while sold out (D2108). */
  readonly orderable: boolean;
}

/** Whether the product is sold out and whether a buyer may still order it. */
export interface SaleState {
  readonly soldOut: boolean;
  readonly orderable: boolean;
}

const previewOf = (id: CoreId | null, previews: ImagePreviews): string | null =>
  id === null ? null : (previews.get(id) ?? null);

const imageOf = (id: CoreId | null, previews: ImagePreviews): VisibleImage | null => {
  const preview = previewOf(id, previews);
  return id === null || preview === null ? null : { id, preview };
};

const visibleVariantOf = (variant: VariantRecord, previews: ImagePreviews): VisibleVariant => ({
  id: variant.id,
  name: variant.name,
  sku: variant.sku,
  price: variant.price,
  oldPrice: variant.oldPrice,
  optionValues: variant.optionValues,
  featuredAssetId: variant.featuredAssetId,
  featuredAssetPreview: previewOf(variant.featuredAssetId, previews),
});

/**
 * The groups and values the shown variants use (#246): a variant's option values are in group order, so the value at
 * place `i` belongs to group `i`, and a value name another group shares is never mistaken for it. A group left with no
 * value is dropped; the merchant's order of groups and values is kept.
 */
function usedOptionGroups(
  groups: readonly OptionGroupRecord[],
  variants: readonly VariantRecord[],
): OptionGroupRecord[] {
  return groups.flatMap((group, place) => {
    const used = new Set(variants.map((variant) => variant.optionValues[place]));
    const values = group.values.filter((value) => used.has(value.name));
    return values.length === 0 ? [] : [{ ...group, values }];
  });
}

/** Every image id a product's public shape shows a preview of: featured, gallery and variant images. */
export function imageIdsOf(view: ProductView): CoreId[] {
  const variantImages = view.variants.flatMap((variant) => variant.featuredAssetId ?? []);
  return [...(view.featuredAssetId === null ? [] : [view.featuredAssetId]), ...view.assetIds, ...variantImages];
}

/** The product's own fields a buyer may see, named one by one so a new merchant-only field is never shown by default. */
const productFieldsOf = (
  view: ProductView,
): Omit<VisibleProduct, 'variants' | 'optionGroups' | 'featuredAsset' | 'assets' | 'settings' | keyof SaleState> => ({
  id: view.id,
  slug: view.slug,
  title: view.title,
  description: view.description,
  status: view.status,
  type: view.type,
  price: view.price,
  oldPrice: view.oldPrice,
  sku: view.sku,
  weight: view.weight,
  width: view.width,
  height: view.height,
  length: view.length,
  featuredAssetId: view.featuredAssetId,
  assetIds: view.assetIds,
  brandId: view.brandId,
  label: view.label,
  cardCaption: view.cardCaption,
  metaTitle: view.metaTitle,
  metaDescription: view.metaDescription,
  tagIds: view.tagIds,
  highlightIds: view.highlightIds,
  collectionIds: view.collectionIds,
  createdAt: view.createdAt,
  updatedAt: view.updatedAt,
});

/**
 * The public shape of a merchant's view: hidden variants and merchant-only fields are left out here, at the one public
 * read path (D2109), so no storefront, product page or landing page has to remember to drop them.
 */
export function visibleProductOf(view: ProductView, state: SaleState, previews: ImagePreviews): VisibleProduct {
  const { settings } = view;
  const shown = view.variants.filter((variant) => !variant.isHidden);
  return {
    ...productFieldsOf(view),
    variants: shown.map((variant) => visibleVariantOf(variant, previews)),
    optionGroups: usedOptionGroups(view.optionGroups, shown),
    featuredAsset: imageOf(view.featuredAssetId, previews),
    assets: view.assetIds.flatMap((id) => imageOf(id, previews) ?? []),
    settings: { quantityRules: settings.quantityRules, customAttributes: settings.customAttributes },
    ...state,
  };
}
