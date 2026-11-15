import type { CoreId } from '../../domain/core-id';
import type {
  CollectionMembershipSource,
  CollectionOption,
} from '../../domain/ports/collection-membership-source.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';

const NONE: readonly CoreId[] = [];

/**
 * A membership source that answers the Collection filter's options of each store from its own map, keyed by store id,
 * and records the scope of every options call: a test sees which store the caller's scope named. It holds no links.
 */
export class StoreKeyedCollectionSource implements CollectionMembershipSource {
  readonly optionScopes: StoreScope[] = [];

  constructor(private readonly optionsByStore: ReadonlyMap<string, readonly CollectionOption[]>) {}

  replaceProductCollections(): Promise<void> {
    return Promise.resolve();
  }

  collectionIdsOf(): Promise<readonly CoreId[]> {
    return Promise.resolve(NONE);
  }

  productIdsInCollection(): Promise<readonly CoreId[]> {
    return Promise.resolve(NONE);
  }

  deleteProductLinks(): Promise<void> {
    return Promise.resolve();
  }

  manualCollectionIdsAmong(): Promise<readonly CoreId[]> {
    return Promise.resolve(NONE);
  }

  collectionOptionsOf(_ctx: OperationContext, scope: StoreScope): Promise<readonly CollectionOption[]> {
    this.optionScopes.push(scope);
    return Promise.resolve(this.optionsByStore.get(scope.storeId) ?? []);
  }
}
