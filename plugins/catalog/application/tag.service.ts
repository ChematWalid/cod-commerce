import type { TagCommand } from '@cod/shared';
import { TagNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { createTag, renameTag, type Tag } from '../domain/taxonomy';
import type { ProductPorts } from './catalog-ports';
import { CatalogNames } from './catalog-names';

/**
 * The tags of the caller's active store: add, rename, list and delete. A deleted tag leaves every product, and each of
 * them is announced as changed in the delete's transaction, so collection rules naming the tag follow (D2311).
 */
export class TagService {
  private readonly names: CatalogNames;

  constructor(private readonly ports: ProductPorts) {
    this.names = new CatalogNames(ports, ports.tags, {
      create: createTag,
      rename: renameTag,
      notFound: TagNotFoundError,
    });
  }

  list(ctx: OperationContext, scope: StoreScope): Promise<readonly Tag[]> {
    return this.names.list(ctx, scope);
  }

  create(ctx: OperationContext, scope: StoreScope, command: TagCommand): Promise<Tag> {
    return this.names.create(ctx, scope, command.name);
  }

  update(ctx: OperationContext, scope: StoreScope, rawId: string, command: TagCommand): Promise<Tag> {
    return this.names.update(ctx, scope, rawId, command.name);
  }

  delete(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<void> {
    return this.names.delete(ctx, scope, rawId, async (tx, id) => {
      const unlinked = await this.ports.tags.productIdsWithTag(tx, scope, id);
      for (const productId of unlinked) await this.ports.events.publish(tx, scope, productId, 'updated');
    });
  }
}
