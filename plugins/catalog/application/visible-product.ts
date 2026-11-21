import type { VariantRecord } from '../domain/product';
import type { ProductSettingsValues } from '../domain/product-settings';
import type { ProductView } from './product-view';

/** A variant a buyer may pick: its barcode and hidden flag are the merchant's. */
export type VisibleVariant = Omit<VariantRecord, 'barcode' | 'isHidden'>;

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

const visibleVariantOf = (variant: VariantRecord): VisibleVariant => ({
  id: variant.id,
  name: variant.name,
  sku: variant.sku,
  price: variant.price,
  oldPrice: variant.oldPrice,
  optionValues: variant.optionValues,
  featuredAssetId: variant.featuredAssetId,
});

/** The product's own fields a buyer may see, named one by one so a new merchant-only field is never shown by default. */
const productFieldsOf = (view: ProductView): Omit<VisibleProduct, 'variants' | 'settings' | keyof SaleState> => ({
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
  optionGroups: view.optionGroups,
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
export function visibleProductOf(view: ProductView, state: SaleState): VisibleProduct {
  const { variants, settings } = view;
  return {
    ...productFieldsOf(view),
    variants: variants.filter((variant) => !variant.isHidden).map(visibleVariantOf),
    settings: { quantityRules: settings.quantityRules, customAttributes: settings.customAttributes },
    ...state,
  };
}
