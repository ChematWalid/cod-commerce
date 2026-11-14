import type { ProductListQueryInput, ProductStatus } from '@cod/shared';

/** The options `catalogProducts` takes: the shared list query (AC4, D2123). */
export type CatalogProductListInput = ProductListQueryInput;

/** A product as the list shows it: the fields of `catalogProducts` the page asks for. */
export interface CatalogProductRowDto {
  readonly id: string;
  readonly title: string;
  readonly status: ProductStatus;
  readonly price: number;
  readonly featuredAsset: { readonly id: string } | null;
  readonly collectionIds: readonly string[];
  readonly createdAt: string;
}

export interface CatalogProductPageDto {
  readonly items: readonly CatalogProductRowDto[];
  readonly totalItems: number;
}

/** A brand or a tag of the active store, as a filter offers it. */
export interface CatalogNamedDto {
  readonly id: string;
  readonly name: string;
}

/** The preview of one image of the media library, by the Vendure asset a product names. */
export interface CatalogMediaPreviewDto {
  readonly assetId: string;
  readonly previewUrl: string;
}
