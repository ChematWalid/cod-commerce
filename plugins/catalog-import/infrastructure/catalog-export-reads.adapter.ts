import { CatalogProductCommands } from '@cod/plugin-catalog';
import { Injectable } from '@nestjs/common';
import type { TaxonomyRefs } from '../application/ports/catalog-products.port';
import type {
  CatalogExportReadsPort,
  ExportIdsPage,
  ExportIdsPageRequest,
} from '../application/ports/catalog-export-reads.port';
import type { OperationContext } from '../application/ports/operation-context';
import type { ExportableProduct } from '../domain/export-row';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-context';

/**
 * {@link CatalogExportReadsPort} on catalog's explicit-scope facade (D2201): the product view already has the shape an
 * export reads, and the ids are the list's own filter, paged ascending (D2218). The scope comes from the tenant guard
 * (request) or the job row (worker), never from the ctx channel (D2236).
 */
@Injectable()
export class CatalogExportReadsAdapter implements CatalogExportReadsPort {
  constructor(private readonly commands: CatalogProductCommands) {}

  async product(ctx: OperationContext, scope: StoreScope, productId: string): Promise<ExportableProduct | undefined> {
    return this.commands.byId(toRequestContext(ctx), scope, productId);
  }

  async idsPage(ctx: OperationContext, scope: StoreScope, page: ExportIdsPageRequest): Promise<ExportIdsPage> {
    return this.commands.listIdsPage(toRequestContext(ctx), scope, page);
  }

  taxonomyIndex(ctx: OperationContext, scope: StoreScope): Promise<TaxonomyRefs> {
    return this.commands.taxonomyIndex(toRequestContext(ctx), scope);
  }
}
