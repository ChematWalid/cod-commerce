import type { OperationContext } from './operation-context';

/** The texts of a collection, in the store channel's language (D2112). */
export interface CollectionTexts {
  readonly title: string;
  /** The slug as the merchant typed it, or the title when none was given; stored the way Vendure stores slugs. */
  readonly slug: string;
  readonly description: string | null;
}

/** What a new Vendure collection is made of (D2300); `isPrivate` mirrors our `visible` column (D2318). */
export interface NewVendureCollection extends CollectionTexts {
  readonly featuredAssetId: string | null;
  readonly isPrivate: boolean;
}

/** A change to a Vendure collection: an absent field stays as it is, `null` clears the description or the image. */
export interface VendureCollectionPatch {
  readonly texts?: CollectionTexts;
  readonly featuredAssetId?: string | null;
  readonly isPrivate?: boolean;
}

/** A collection image: its asset id and the URL of its preview. */
export interface CollectionImage {
  readonly id: string;
  readonly preview: string;
}

/** What the store's Vendure collection holds beside our definition. */
export interface CollectionMeta {
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly featuredAsset: CollectionImage | null;
}

/**
 * The Vendure `Collection` behind each store collection (D2300). Every call runs in the active channel of `ctx`, the
 * store's, and in its transaction; collection and asset ids are canonical decimal strings.
 */
export interface VendureCollectionsPort {
  /** Creates the collection in the store channel only: it leaves the default channel in the same transaction (D2333). */
  create(ctx: OperationContext, collection: NewVendureCollection): Promise<string>;
  update(ctx: OperationContext, collectionId: string, patch: VendureCollectionPatch): Promise<void>;
  delete(ctx: OperationContext, collectionId: string): Promise<void>;
  /** The store channel's collections among `collectionIds`; one of another channel is simply absent. */
  findMany(ctx: OperationContext, collectionIds: readonly string[]): Promise<ReadonlyMap<string, CollectionMeta>>;
  /** The slug as the store would keep it (D2319): what availability answers and `slugTaken` compares. */
  storedSlugOf(slug: string): string;
  /** Whether another collection of the store channel already uses the slug (D2319), `exceptId` aside. */
  slugTaken(ctx: OperationContext, slug: string, exceptId?: string): Promise<boolean>;
  /** Whether the asset is one of the store channel's (D2320). */
  assetExists(ctx: OperationContext, assetId: string): Promise<boolean>;
}
