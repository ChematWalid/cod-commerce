import {
  type CatalogCollectionOption,
  type CatalogOperationContext,
  type CatalogStoreScope,
  COLLECTION_MEMBERSHIP_SOURCE_REGISTRAR,
  type CollectionMembershipSource,
  type CollectionMembershipSourceRegistrar,
  type CoreId,
  toCoreId,
} from '@cod/plugin-catalog';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ProductLinksService } from '../application/product-links.service';
import { asOperationContext, type OperationContext } from '../domain/ports/operation-context';
import { asCatalogRefusal } from './catalog-refusals';

/** The catalog's context is the same Vendure context under the catalog's brand. */
const ours = (ctx: CatalogOperationContext): OperationContext => asOperationContext(ctx);

/**
 * Where the catalog reads and writes product collections once collection rules are on (D2309): a product's own
 * collection ids are its manual collections; the list filter sees every member, matched ones included. Registered on
 * bootstrap, so the catalog never depends on this plugin. Every write takes the store lock (D2334).
 */
@Injectable()
export class CollectionsMembershipSource implements CollectionMembershipSource, OnApplicationBootstrap {
  constructor(
    private readonly links: ProductLinksService,
    @Inject(COLLECTION_MEMBERSHIP_SOURCE_REGISTRAR) private readonly registrar: CollectionMembershipSourceRegistrar,
  ) {}

  onApplicationBootstrap(): void {
    this.registrar.register(this);
  }

  /** Refuses a collection that is not (or no longer) manual with `catalog.collection-not-found` and writes nothing. */
  async replaceProductCollections(
    ctx: CatalogOperationContext,
    scope: CatalogStoreScope,
    productId: CoreId,
    collectionIds: readonly CoreId[],
  ): Promise<void> {
    try {
      await this.links.replaceManual(ours(ctx), scope, productId, collectionIds);
    } catch (error: unknown) {
      throw asCatalogRefusal(error);
    }
  }

  async collectionIdsOf(
    ctx: CatalogOperationContext,
    scope: CatalogStoreScope,
    productId: CoreId,
  ): Promise<readonly CoreId[]> {
    const refs = await this.links.collectionsOf(ours(ctx), scope, productId);
    return refs.filter((ref) => ref.manual).map((ref) => toCoreId(ref.id));
  }

  async productIdsInCollection(
    ctx: CatalogOperationContext,
    scope: CatalogStoreScope,
    collectionId: CoreId,
  ): Promise<readonly CoreId[]> {
    return (await this.links.productIdsIn(ours(ctx), scope, collectionId)).map(toCoreId);
  }

  deleteProductLinks(ctx: CatalogOperationContext, scope: CatalogStoreScope, productId: CoreId): Promise<void> {
    return this.links.deleteProduct(ours(ctx), scope, productId);
  }

  async manualCollectionIdsAmong(
    ctx: CatalogOperationContext,
    scope: CatalogStoreScope,
    collectionIds: readonly CoreId[],
  ): Promise<readonly CoreId[]> {
    return (await this.links.manualAmong(ours(ctx), scope, collectionIds)).map(toCoreId);
  }

  async collectionOptionsOf(
    ctx: CatalogOperationContext,
    scope: CatalogStoreScope,
  ): Promise<readonly CatalogCollectionOption[]> {
    const refs = await this.links.options(ours(ctx), scope);
    return refs.map((ref) => ({ id: toCoreId(ref.id), title: ref.title }));
  }
}
