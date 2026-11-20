import { CatalogProductCommands } from '@cod/plugin-catalog';
import { Injectable } from '@nestjs/common';
import type { OperationContext } from '../application/ports/operation-context';
import type { ProductText, ProductTextReads } from '../application/ports/product-polisher.port';
import type { StoreScope } from '../domain/store-scope';
import { toRequestContext } from './request-context';

/** {@link ProductTextReads} on catalog's explicit-scope facade (D2201): a product of another store reads as none. */
@Injectable()
export class CatalogProductTextAdapter implements ProductTextReads {
  constructor(private readonly commands: CatalogProductCommands) {}

  async textOf(ctx: OperationContext, scope: StoreScope, productId: string): Promise<ProductText | undefined> {
    const view = await this.commands.byId(toRequestContext(ctx), scope, productId);
    if (view === undefined) return undefined;
    return { title: view.title, ...(view.description === null ? {} : { description: view.description }) };
  }
}
