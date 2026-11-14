import type { ProductSaveResult, ProductView } from '../application/product-view';
import type { SlugAvailability } from '../application/slug-availability.service';
import type { ProductViewPage } from '../application/list-products.service';
import type { ProductSettingsValues } from '../domain/product-settings';
import type { CoreId } from '../domain/core-id';
import type { OptionGroupRecord, VariantRecord } from '../domain/product';

/** A media item a product or variant points at; Task 13 adds its URL. */
export interface CatalogMediaRefDto {
  readonly id: string;
}

/** One variant as both API surfaces answer it. */
export interface CatalogVariantDto {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly price: number;
  readonly oldPrice: number | null;
  readonly barcode: string | null;
  readonly isHidden: boolean;
  readonly optionValues: readonly string[];
  readonly featuredAsset: CatalogMediaRefDto | null;
}

/** One product as both API surfaces answer it (`CatalogProduct`). */
export interface CatalogProductDto {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: string;
  readonly type: string;
  readonly price: number;
  readonly oldPrice: number | null;
  readonly sku: string | null;
  readonly barcode: string | null;
  readonly weight: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly length: number | null;
  readonly featuredAsset: CatalogMediaRefDto | null;
  readonly assets: readonly CatalogMediaRefDto[];
  readonly brandId: string | null;
  readonly tagIds: readonly string[];
  readonly highlightIds: readonly string[];
  readonly collectionIds: readonly string[];
  readonly label: string | null;
  readonly cardCaption: string | null;
  readonly metaTitle: string | null;
  readonly metaDescription: string | null;
  readonly optionGroups: readonly OptionGroupRecord[];
  readonly variants: readonly CatalogVariantDto[];
  readonly settings: ProductSettingsValues;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A list page (`CatalogProductList`). */
export interface CatalogProductListDto {
  readonly items: readonly CatalogProductDto[];
  readonly totalItems: number;
}

/** A save (`CatalogProductSaveResult`): the product and the warnings that did not stop it. */
export interface CatalogProductSaveResultDto {
  readonly product: CatalogProductDto;
  readonly warnings: readonly string[];
}

/** The slug check (`CatalogSlugAvailability`). */
export type CatalogSlugAvailabilityDto = SlugAvailability;

const mediaRefOf = (id: CoreId | null): CatalogMediaRefDto | null => (id === null ? null : { id });

function toVariantDto(variant: VariantRecord): CatalogVariantDto {
  const { featuredAssetId, ...rest } = variant;
  return { ...rest, featuredAsset: mediaRefOf(featuredAssetId) };
}

export function toProductDto(view: ProductView): CatalogProductDto {
  const { featuredAssetId, assetIds, variants, ...rest } = view;
  return {
    ...rest,
    featuredAsset: mediaRefOf(featuredAssetId),
    assets: assetIds.map((id) => ({ id })),
    variants: variants.map(toVariantDto),
  };
}

export const toProductListDto = (page: ProductViewPage): CatalogProductListDto => ({
  items: page.items.map(toProductDto),
  totalItems: page.totalItems,
});

export const toSaveResultDto = (result: ProductSaveResult): CatalogProductSaveResultDto => ({
  product: toProductDto(result.product),
  warnings: result.warnings,
});
