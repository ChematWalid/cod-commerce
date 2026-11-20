import type { OperationContext } from '../../domain/ports/operation-context';
import type {
  CollectionMeta,
  NewVendureCollection,
  VendureCollectionPatch,
  VendureCollectionsPort,
} from '../../domain/ports/vendure-collections.port';

/** A Vendure collection as the fake keeps it. */
export interface FakeVendureCollection {
  readonly meta: CollectionMeta;
  readonly isPrivate: boolean;
}

const PREVIEW_PREFIX = 'https://assets.test/preview/';

/** Slugs compared the way the adapter stores them, in a simplified form: trimmed, lower case, dashes. */
const slugKey = (slug: string): string => slug.trim().toLowerCase().replaceAll(/\s+/g, '-');

/**
 * {@link VendureCollectionsPort} for use-case tests: one store channel's collections and assets in memory. Rejections
 * are asynchronous, like the adapter's.
 */
export class FakeVendureCollections implements VendureCollectionsPort {
  readonly rows = new Map<string, FakeVendureCollection>();
  readonly assets = new Set<string>(['31', '32']);
  /** The collection ids `update` was called with, in order. */
  readonly updated: string[] = [];
  private nextId = 900;

  create(_ctx: OperationContext, collection: NewVendureCollection): Promise<string> {
    this.nextId += 1;
    const id = String(this.nextId);
    this.rows.set(id, { meta: this.metaOf(collection, collection.featuredAssetId), isPrivate: collection.isPrivate });
    return Promise.resolve(id);
  }

  update(_ctx: OperationContext, collectionId: string, patch: VendureCollectionPatch): Promise<void> {
    this.updated.push(collectionId);
    return Promise.resolve().then(() => {
      const row = this.rows.get(collectionId);
      if (row === undefined) throw new Error('no such Vendure collection');
      const imageId =
        patch.featuredAssetId === undefined ? (row.meta.featuredAsset?.id ?? null) : patch.featuredAssetId;
      const meta = this.metaOf(patch.texts ?? row.meta, imageId);
      this.rows.set(collectionId, { meta, isPrivate: patch.isPrivate ?? row.isPrivate });
    });
  }

  delete(_ctx: OperationContext, collectionId: string): Promise<void> {
    // Vendure's CollectionService.delete throws for a collection that is not in the channel.
    if (!this.rows.delete(collectionId)) return Promise.reject(new Error('no such Vendure collection'));
    return Promise.resolve();
  }

  findMany(_ctx: OperationContext, collectionIds: readonly string[]): Promise<ReadonlyMap<string, CollectionMeta>> {
    const found = collectionIds.flatMap((id) => {
      const row = this.rows.get(id);
      return row === undefined ? [] : [[id, row.meta] as const];
    });
    return Promise.resolve(new Map(found));
  }

  slugTaken(_ctx: OperationContext, slug: string, exceptId?: string): Promise<boolean> {
    const taken = [...this.rows].some(([id, row]) => id !== exceptId && row.meta.slug === slugKey(slug));
    return Promise.resolve(taken);
  }

  assetExists(_ctx: OperationContext, assetId: string): Promise<boolean> {
    return Promise.resolve(this.assets.has(assetId));
  }

  private metaOf(texts: Omit<CollectionMeta, 'featuredAsset'>, imageId: string | null): CollectionMeta {
    const featuredAsset = imageId === null ? null : { id: imageId, preview: `${PREVIEW_PREFIX}${imageId}` };
    return { title: texts.title, slug: slugKey(texts.slug), description: texts.description, featuredAsset };
  }
}
