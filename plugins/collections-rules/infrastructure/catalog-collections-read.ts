import type { PublicListContext, VisibleProductPage } from '@cod/plugin-catalog';
import { Inject, Injectable } from '@nestjs/common';
import type { CollectionPorts } from '../application/collection-ports';
import { CollectionsReadService } from '../application/collections-read.service';
import { COLLECTION_PORTS } from '../application/tokens';
import { CatalogVisibleProducts } from './catalog-visible-products.adapter';
import { TenancyActiveStore } from './tenancy-active-store.adapter';

/**
 * The public collections read bound to the catalog's public list context and product page (D2316): the class other
 * plugins inject, exported from the entry as `CollectionsReadService`.
 */
@Injectable()
export class CatalogCollectionsReadService extends CollectionsReadService<PublicListContext, VisibleProductPage> {
  constructor(
    @Inject(COLLECTION_PORTS) ports: CollectionPorts,
    stores: TenancyActiveStore,
    products: CatalogVisibleProducts,
  ) {
    super(ports, stores, products);
  }
}
