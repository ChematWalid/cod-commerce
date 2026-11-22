import { TOWN_DIRECTORY } from '@cod/plugin-geo';
import { type SnowflakeIdGeneratorPort, SNOWFLAKE_ID_GENERATOR, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { DefaultTableService } from '../application/default-table.service';
import { DeleteFeeGroupService } from '../application/delete-fee-group.service';
import { DeliveryDefaultsConvergeService } from '../application/delivery-defaults-converge.service';
import type { FeeGroupPorts } from '../application/fee-group-ports';
import { FeeGroupReadService } from '../application/fee-group-read.service';
import { SaveFeeGroupService } from '../application/save-fee-group.service';
import { SetCommuneRatesService } from '../application/set-commune-rates.service';
import { ShippingQuoteService } from '../application/shipping-quote.service';
import {
  FEE_GROUP_PORTS,
  FEE_GROUP_REPOSITORY,
  FEE_GROUP_TRANSACTION,
  PRODUCT_WEIGHTS,
  STORE_DEFAULTS,
  TOWNS,
} from '../application/tokens';
import type { FeeGroupRepositoryPort } from '../domain/ports/fee-group-repository.port';
import type { ProductWeightsPort } from '../domain/ports/product-weights.port';
import type { StoreDefaultsPort } from '../domain/ports/store-defaults.port';
import type { TownDirectoryPort } from '../domain/ports/town-directory.port';
import type { TransactionPort } from '../domain/ports/transaction.port';
import { CatalogProductWeights } from './catalog-product-weights.adapter';
import { DeliveryPricingLifecycleHook } from './delivery-pricing-lifecycle.hook';
import { DeliveryFeeGroupReferenceCheck } from './fee-group-reference.check';
import { OffersShippingQuoteAdapter } from './offers-shipping-quote.adapter';
import { TenancyStoreDefaults } from './tenancy-store-defaults.adapter';
import { TransactionAdapter } from './transaction.adapter';
import { TypeOrmFeeGroupRepository } from './typeorm-fee-group.repository';

/** A use case built from the port bundle. */
const useCase = (type: new (ports: FeeGroupPorts) => object): Provider => ({
  provide: type,
  useFactory: (ports: FeeGroupPorts) => new type(ports),
  inject: [FEE_GROUP_PORTS],
});

/**
 * Wires the fee-group use cases to their adapters; geo's town directory checks the communes (D3125) and the catalog's
 * weight reader weighs a parcel (D3119). The reference check and the lifecycle hook register themselves on tenancy's
 * seams at bootstrap (D3111), the offers adapter on the offers' shipping quote seam (D2423).
 */
export const DELIVERY_PRICING_PROVIDERS: Provider[] = [
  { provide: FEE_GROUP_TRANSACTION, useClass: TransactionAdapter },
  { provide: STORE_DEFAULTS, useClass: TenancyStoreDefaults },
  { provide: TOWNS, useExisting: TOWN_DIRECTORY },
  { provide: PRODUCT_WEIGHTS, useClass: CatalogProductWeights },
  {
    provide: FEE_GROUP_REPOSITORY,
    useFactory: (factory: TenantRepositoryFactory, ids: SnowflakeIdGeneratorPort) =>
      new TypeOrmFeeGroupRepository(factory, ids),
    inject: [TenantRepositoryFactory, SNOWFLAKE_ID_GENERATOR],
  },
  {
    provide: FEE_GROUP_PORTS,
    useFactory: (
      groups: FeeGroupRepositoryPort,
      transaction: TransactionPort,
      storeDefaults: StoreDefaultsPort,
      towns: TownDirectoryPort,
    ): FeeGroupPorts => ({ groups, transaction, storeDefaults, towns }),
    inject: [FEE_GROUP_REPOSITORY, FEE_GROUP_TRANSACTION, STORE_DEFAULTS, TOWNS],
  },
  useCase(FeeGroupReadService),
  useCase(SaveFeeGroupService),
  useCase(DeleteFeeGroupService),
  useCase(SetCommuneRatesService),
  useCase(DefaultTableService),
  useCase(DeliveryDefaultsConvergeService),
  {
    provide: ShippingQuoteService,
    useFactory: (ports: FeeGroupPorts, weights: ProductWeightsPort) => new ShippingQuoteService(ports, weights),
    inject: [FEE_GROUP_PORTS, PRODUCT_WEIGHTS],
  },
  DeliveryFeeGroupReferenceCheck,
  DeliveryPricingLifecycleHook,
  OffersShippingQuoteAdapter,
];
