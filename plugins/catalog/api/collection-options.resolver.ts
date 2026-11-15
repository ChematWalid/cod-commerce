import { requirePermission } from '@cod/plugin-rbac/guard';
import { Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { CollectionOptionsService } from '../application/collection-options.service';
import { asOperationContext } from '../domain/ports/operation-context';
import type { CatalogCollectionOptionDto } from './dto';
import { withCatalogErrors } from './error-mapping';
import { PRODUCT_PERMISSIONS } from './permissions';
import { scopeOf } from './store-scope-of';

/** The Collection filter's options of the active store on the Admin API (D2324). */
@Resolver()
export class CollectionOptionsResolver {
  constructor(private readonly options: CollectionOptionsService) {}

  /** The active store's collections with their titles; none without collection rules (catalog.products.view). */
  @Query()
  @requirePermission(PRODUCT_PERMISSIONS.view)
  catalogCollectionOptions(@Ctx() ctx: RequestContext): Promise<readonly CatalogCollectionOptionDto[]> {
    return withCatalogErrors(async () => {
      const options = await this.options.list(asOperationContext(ctx), scopeOf(ctx));
      return options.map(({ id, title }) => ({ id, title }));
    });
  }
}
