import type { PackPreview, PackView } from '../application/pack-view';

/** One component line as both API surfaces answer it. */
export interface CatalogPackComponentDto {
  readonly productId: string;
  readonly variantId: string | null;
  readonly quantity: number;
}

/** A pack as both API surfaces answer it (`CatalogPack`): its definition and what its product stores. */
export interface CatalogPackDto {
  readonly productId: string;
  readonly status: string;
  readonly packPricingMode: string;
  readonly packFixedPrice: number | null;
  readonly packDiscountType: string | null;
  readonly packDiscountValue: number | null;
  readonly packVariantMode: string;
  readonly packSharedOption: string | null;
  readonly packWeightMode: string;
  readonly packFixedWeightGrams: number | null;
  readonly components: readonly CatalogPackComponentDto[];
  readonly price: number;
  readonly weightGrams: number | null;
}

/** What a preview answers (`CatalogPackPreview`). */
export interface CatalogPackPreviewDto {
  readonly price: number;
  readonly weightGrams: number;
  readonly sharedValues: readonly { readonly value: string; readonly price: number }[];
}

/** The answer shape of a stored pack. */
export function toPackDto({ pack, price, weightGrams }: PackView): CatalogPackDto {
  return {
    productId: pack.productId,
    status: pack.status,
    packPricingMode: pack.packPricingMode,
    packFixedPrice: pack.packFixedPrice,
    packDiscountType: pack.packDiscountType,
    packDiscountValue: pack.packDiscountValue,
    packVariantMode: pack.packVariantMode,
    packSharedOption: pack.packSharedOption,
    packWeightMode: pack.packWeightMode,
    packFixedWeightGrams: pack.packFixedWeightGrams,
    components: pack.components.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
    price,
    weightGrams,
  };
}

/** The answer shape of a preview. */
export const toPreviewDto = (preview: PackPreview): CatalogPackPreviewDto => ({
  price: preview.price,
  weightGrams: preview.weightGrams,
  sharedValues: preview.sharedValues.map(({ value, price }) => ({ value, price })),
});
