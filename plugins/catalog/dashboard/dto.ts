import type { ProductListQueryInput, ProductStatus, StoreAccessKind } from '@cod/shared';

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
  /** Whether it is sold out and still takes orders, for the row's marks (D2108). */
  readonly settings: { readonly soldOut: boolean; readonly allowOutOfStockOrders: boolean };
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

/** An image a product or a variant names: the Vendure asset of a media library entry. */
export interface CatalogMediaRefDto {
  readonly id: string;
}

export interface CatalogOptionGroupDto {
  readonly id: string;
  readonly name: string;
  readonly values: readonly { readonly id: string; readonly name: string }[];
}

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

export interface CatalogProductSettingsDto {
  readonly nameInDelivery: string | null;
  readonly isFragile: boolean;
  readonly allowParcelOpening: boolean;
  readonly allowOutOfStockOrders: boolean;
  readonly soldOut: boolean;
  readonly quantityRules: { readonly enabled: boolean; readonly min: number; readonly step: number };
  readonly orderManagerIds: readonly string[];
}

/** A product as the editor reads it (`catalogProduct`). */
export interface CatalogProductDto {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
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
  readonly optionGroups: readonly CatalogOptionGroupDto[];
  readonly variants: readonly CatalogVariantDto[];
  readonly settings: CatalogProductSettingsDto;
}

/** What a create or an update answers: the saved product and the warnings that did not block it (AC3). */
export interface CatalogProductSaveDto {
  readonly product: CatalogProductDto;
  readonly warnings: readonly string[];
}

/** A highlight of the active store. */
export interface CatalogHighlightDto {
  readonly id: string;
  readonly text: string;
}

/** One image of the business's media library, as the picker shows it. */
export interface CatalogMediaDto {
  readonly id: string;
  readonly assetId: string;
  readonly previewUrl: string;
}

/** A member who may be named order manager (`teamOrderManagers`). */
export interface CatalogOrderManagerDto {
  readonly id: string;
  readonly name: string | null;
  /** `all` reaches every store of the business; `selected` only `storeIds` (D2114). */
  readonly storeAccess: StoreAccessKind;
  readonly storeIds: readonly string[];
}
