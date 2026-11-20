import type { CollectionMode } from '@cod/shared';

/** One condition as the API answers it; the fields a condition does not use are null (`StoreCollectionCondition`). */
export interface StoreCollectionConditionDto {
  readonly field: string;
  readonly operator: string;
  readonly option?: string | null;
  readonly values?: readonly string[] | null;
  readonly min?: number | null;
  readonly max?: number | null;
  readonly value?: boolean | null;
}

export interface StoreCollectionRuleDto {
  readonly version: number;
  readonly match: string;
  readonly conditions: readonly StoreCollectionConditionDto[];
}

export interface StoreCollectionImageDto {
  readonly id: string;
  readonly preview: string;
}

/** A collection of the active store (`StoreCollection`). */
export interface StoreCollectionDto {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly featuredAsset: StoreCollectionImageDto | null;
  readonly mode: CollectionMode;
  readonly rule: StoreCollectionRuleDto | null;
  readonly visible: boolean;
  readonly position: number;
  readonly productCount: number;
}

export interface StoreCollectionPageDto {
  readonly items: readonly StoreCollectionDto[];
  readonly totalItems: number;
}

/** A product as a collection lists it, or as the product search finds it (`StoreCollectionProduct`). */
export interface StoreCollectionProductDto {
  readonly productId: string;
  readonly title: string;
  readonly status: string;
  readonly price: number;
}

export interface StoreCollectionProductPageDto {
  readonly items: readonly StoreCollectionProductDto[];
  readonly totalItems: number;
}

export interface StoreCollectionSlugDto {
  readonly slug: string;
  readonly available: boolean;
}

/** An image of catalog's media library (D2320). */
export interface CollectionMediaDto {
  readonly id: string;
  readonly assetId: string;
  readonly previewUrl: string;
}

/** The fields of a create; the server derives a blank slug from the title (D2319). */
export interface CreateStoreCollectionInput {
  readonly title: string;
  readonly slug?: string;
  readonly description?: string;
  readonly featuredAssetId?: string;
  readonly visible: boolean;
  readonly position: number;
  readonly mode: CollectionMode;
  readonly rule?: StoreCollectionRuleDto;
}

/** The fields of an update: only the changed ones; `null` clears the description or the image. */
export interface UpdateStoreCollectionInput {
  readonly title?: string;
  readonly slug?: string;
  readonly description?: string | null;
  readonly featuredAssetId?: string | null;
  readonly visible?: boolean;
  readonly position?: number;
  readonly mode?: CollectionMode;
  readonly rule?: StoreCollectionRuleDto;
}
