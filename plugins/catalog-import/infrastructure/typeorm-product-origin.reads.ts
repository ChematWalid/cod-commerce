import { parseCoreId } from '@cod/plugin-catalog';
import { type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { OperationContext } from '../application/ports/operation-context';
import type { ProductOriginReads } from '../application/ports/product-origin.port';
import type { OriginView } from '../domain/export-row';
import type { StoreScope } from '../domain/store-scope';
import { ProductOriginEntity } from './product-origin.entity';
import { requestScope } from './request-context';

const isText = (value: unknown): value is string => typeof value === 'string';

/** The image links a row stored: only text entries of a JSON array count (the column is ours, but jsonb is loose). */
const imageUrlsOf = (stored: unknown): readonly string[] => (Array.isArray(stored) ? stored.filter(isText) : []);

/** A product id as the origin table stores it (Vendure's integer id); a malformed one names no row. */
function productIdOf(id: string): number | undefined {
  const parsed = parseCoreId(id);
  return parsed === undefined ? undefined : Number(parsed);
}

/** {@link ProductOriginReads} on `catalog_product_origin` through `TenantRepository` (ADR 0002). */
@Injectable()
export class TypeOrmProductOriginReads implements ProductOriginReads {
  private readonly origins: TenantRepository<ProductOriginEntity>;

  constructor(factory: TenantRepositoryFactory) {
    this.origins = factory.for(ProductOriginEntity);
  }

  async originsOf(
    ctx: OperationContext,
    scope: StoreScope,
    productIds: readonly string[],
  ): Promise<ReadonlyMap<string, OriginView>> {
    const ids = productIds.flatMap((id) => {
      const parsed = productIdOf(id);
      return parsed === undefined ? [] : [parsed];
    });
    if (ids.length === 0) return new Map();
    const rows = await this.origins.find(requestScope(ctx, scope), {
      where: { storeId: scope.storeId, productId: In(ids) },
    });
    return new Map(rows.map((row) => [String(row.productId), { imageUrls: imageUrlsOf(row.imageUrls) }]));
  }
}
