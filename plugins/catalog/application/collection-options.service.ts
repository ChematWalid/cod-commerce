import type { CollectionOption } from '../domain/ports/collection-membership-source.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';

/**
 * The collections the product list's Collection filter offers (D2324): those the membership source names for the
 * caller's store, none without collection rules. The catalog dashboard never queries a collection-rules type.
 */
export class CollectionOptionsService {
  constructor(private readonly ports: ProductPorts) {}

  list(ctx: OperationContext, scope: StoreScope): Promise<readonly CollectionOption[]> {
    return this.ports.collections.collectionOptionsOf(ctx, scope);
  }
}
