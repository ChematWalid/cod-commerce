import {
  SNOWFLAKE_ID_GENERATOR,
  type SnowflakeIdGeneratorPort,
  type TenantRepository,
  TenantRepositoryFactory,
} from '@cod/plugin-tenancy';
import type { ProductSource } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { ImportedOrigin, ProductOriginWrites } from '../application/ports/catalog-import.port';
import type { LinkedOrigin } from '../application/ports/link-job.port';
import type { OperationContext } from '../application/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { ProductOriginEntity } from './product-origin.entity';
import { requestScope } from './request-context';

const IMPORTED: ProductSource = 'import';
const LINKED: ProductSource = 'link';
/** A product an import only updated keeps its source; one with no origin row yet was made by hand. */
const MANUAL: ProductSource = 'manual';

/**
 * {@link ProductOriginWrites} on `catalog_product_origin` through `TenantRepository` (ADR 0002), in the transaction of
 * the product write (D2210): a created product gets source `import`, the job id and its rows' image links (stored
 * only, never fetched or rendered in P2.S2); an updated one keeps its source and takes the job and links. A link
 * import's product gets source `link` and the image review flag (D2214).
 */
@Injectable()
export class TypeOrmProductOriginWrites implements ProductOriginWrites {
  private readonly origins: TenantRepository<ProductOriginEntity>;

  constructor(
    factory: TenantRepositoryFactory,
    @Inject(SNOWFLAKE_ID_GENERATOR) private readonly ids: SnowflakeIdGeneratorPort,
  ) {
    this.origins = factory.for(ProductOriginEntity);
  }

  async recordImport(ctx: OperationContext, scope: StoreScope, origin: ImportedOrigin): Promise<void> {
    const tenant = requestScope(ctx, scope);
    // eslint-disable-next-line cod-ids/no-numeric-id -- Vendure core id: an int4 column value, exact as a number
    const productId = Number(origin.productId);
    const at = new Date();
    const change = { importJobId: origin.importJobId, imageUrls: [...origin.imageUrls], updatedAt: at };
    const where = { storeId: scope.storeId, productId };
    if ((await this.origins.update(tenant, where, change)) > 0) return;
    await this.origins.insert(tenant, {
      id: this.ids.next(),
      storeId: scope.storeId,
      productId,
      source: origin.created ? IMPORTED : MANUAL,
      needsImageReview: false,
      createdAt: at,
      ...change,
    });
  }

  /** A product a link import just made: its first origin row, flagged for image review (D2214). */
  async recordLink(ctx: OperationContext, scope: StoreScope, origin: LinkedOrigin): Promise<void> {
    const at = new Date();
    await this.origins.insert(requestScope(ctx, scope), {
      id: this.ids.next(),
      storeId: scope.storeId,
      // eslint-disable-next-line cod-ids/no-numeric-id -- Vendure core id: an int4 column value, exact as a number
      productId: Number(origin.productId),
      source: LINKED,
      importJobId: origin.importJobId,
      needsImageReview: true,
      imageUrls: [...origin.imageUrls],
      createdAt: at,
      updatedAt: at,
    });
  }
}
