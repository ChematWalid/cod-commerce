import type { CoreId } from '../domain/core-id';
import { CollectionMembershipSourceAlreadyRegisteredError } from '../domain/errors';
import type {
  CollectionMembershipSource,
  CollectionMembershipSourceRegistrar,
  CollectionOption,
} from '../domain/ports/collection-membership-source.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductCollectionRepositoryPort } from '../domain/ports/product-collection-repository.port';
import type { StoreScope } from '../domain/store-scope';

/** Without collection rules no collection is automatic and nothing names one for the list filter. */
const NO_OPTIONS: readonly CollectionOption[] = [];

/**
 * The collection membership the use cases read (D2309): the `catalog_product_collection` table until collection rules
 * register their source on bootstrap (pattern of the sold-out registry, D2163). Every Vendure collection of the
 * channel is manual while the table answers.
 */
export class CollectionMembershipRegistry implements CollectionMembershipSource, CollectionMembershipSourceRegistrar {
  private registered: CollectionMembershipSource | undefined;

  constructor(private readonly table: ProductCollectionRepositoryPort) {}

  register(source: CollectionMembershipSource): void {
    if (this.registered !== undefined) throw new CollectionMembershipSourceAlreadyRegisteredError();
    this.registered = source;
  }

  replaceProductCollections(
    ctx: OperationContext,
    scope: StoreScope,
    productId: CoreId,
    collectionIds: readonly CoreId[],
  ): Promise<void> {
    return this.links().replaceProductCollections(ctx, scope, productId, collectionIds);
  }

  collectionIdsOf(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<readonly CoreId[]> {
    return this.links().collectionIdsOf(ctx, scope, productId);
  }

  productIdsInCollection(ctx: OperationContext, scope: StoreScope, collectionId: CoreId): Promise<readonly CoreId[]> {
    return this.links().productIdsInCollection(ctx, scope, collectionId);
  }

  deleteProductLinks(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<void> {
    return this.links().deleteProductLinks(ctx, scope, productId);
  }

  manualCollectionIdsAmong(
    ctx: OperationContext,
    scope: StoreScope,
    collectionIds: readonly CoreId[],
  ): Promise<readonly CoreId[]> {
    if (this.registered === undefined) return Promise.resolve(collectionIds);
    return this.registered.manualCollectionIdsAmong(ctx, scope, collectionIds);
  }

  collectionOptionsOf(ctx: OperationContext, scope: StoreScope): Promise<readonly CollectionOption[]> {
    if (this.registered === undefined) return Promise.resolve(NO_OPTIONS);
    return this.registered.collectionOptionsOf(ctx, scope);
  }

  private links(): ProductCollectionRepositoryPort {
    return this.registered ?? this.table;
  }
}

/**
 * The registrar other plugins receive (D2309): it can only register. Handing out the registry itself would let a
 * consumer call its source methods and write product links with no channel check, no manual check, no product lock and
 * no `product.changed` event.
 */
export function registrarOf(registry: CollectionMembershipRegistry): CollectionMembershipSourceRegistrar {
  return Object.freeze({
    register: (source: CollectionMembershipSource): void => {
      registry.register(source);
    },
  });
}
