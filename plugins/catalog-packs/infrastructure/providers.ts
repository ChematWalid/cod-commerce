import { CatalogProductCommands } from '@cod/plugin-catalog';
import { type SnowflakeIdGeneratorPort, SNOWFLAKE_ID_GENERATOR, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { GetPackService } from '../application/get-pack.service';
import { PackPricesService } from '../application/pack-prices.service';
import type { PackPorts } from '../application/pack-ports';
import { PreviewPackService } from '../application/preview-pack.service';
import { RecomputePacksService } from '../application/recompute-packs.service';
import { SavePackService } from '../application/save-pack.service';
import { CATALOG_PRODUCTS, PACK_PORTS, PACK_REPOSITORY, PACK_TRANSACTION } from '../application/tokens';
import type { CatalogProductsPort } from '../domain/ports/catalog-products.port';
import type { PackRepositoryPort } from '../domain/ports/pack-repository.port';
import type { TransactionPort } from '../domain/ports/transaction.port';
import { CatalogProductsAdapter } from './catalog-products.adapter';
import { PackRecomputeConsumer } from './pack-recompute.consumer';
import { PackUnitPriceResolver } from './pack-unit-price.resolver';
import { TransactionAdapter } from './transaction.adapter';
import { TypeOrmPackRepository } from './typeorm-pack.repository';

/** A use case built from the port bundle. */
const useCase = (type: new (ports: PackPorts) => object): Provider => ({
  provide: type,
  useFactory: (ports: PackPorts) => new type(ports),
  inject: [PACK_PORTS],
});

/** Wires the pack use cases to their adapters, and the consumer and resolver to the use cases. */
export const PACK_PROVIDERS: Provider[] = [
  { provide: CATALOG_PRODUCTS, useClass: CatalogProductsAdapter },
  { provide: PACK_TRANSACTION, useClass: TransactionAdapter },
  {
    provide: PACK_REPOSITORY,
    useFactory: (factory: TenantRepositoryFactory, ids: SnowflakeIdGeneratorPort) =>
      new TypeOrmPackRepository(factory, ids),
    inject: [TenantRepositoryFactory, SNOWFLAKE_ID_GENERATOR],
  },
  {
    provide: PACK_PORTS,
    useFactory: (packs: PackRepositoryPort, catalog: CatalogProductsPort, transaction: TransactionPort): PackPorts => ({
      packs,
      catalog,
      transaction,
    }),
    inject: [PACK_REPOSITORY, CATALOG_PRODUCTS, PACK_TRANSACTION],
  },
  useCase(SavePackService),
  useCase(GetPackService),
  useCase(PreviewPackService),
  useCase(RecomputePacksService),
  useCase(PackPricesService),
  {
    provide: PackRecomputeConsumer,
    useFactory: (commands: CatalogProductCommands, recomputing: RecomputePacksService) =>
      new PackRecomputeConsumer(commands, recomputing),
    inject: [CatalogProductCommands, RecomputePacksService],
  },
  PackUnitPriceResolver,
];
