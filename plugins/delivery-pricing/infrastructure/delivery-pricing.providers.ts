import { TOWN_DIRECTORY } from '@cod/plugin-geo';
import { type SnowflakeIdGeneratorPort, SNOWFLAKE_ID_GENERATOR, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { DefaultTableService } from '../application/default-table.service';
import { DeleteFeeGroupService } from '../application/delete-fee-group.service';
import type { FeeGroupPorts } from '../application/fee-group-ports';
import { FeeGroupReadService } from '../application/fee-group-read.service';
import { SaveFeeGroupService } from '../application/save-fee-group.service';
import { SetCommuneRatesService } from '../application/set-commune-rates.service';
import {
  FEE_GROUP_PORTS,
  FEE_GROUP_REPOSITORY,
  FEE_GROUP_TRANSACTION,
  STORE_DEFAULTS,
  TOWNS,
} from '../application/tokens';
import type { FeeGroupRepositoryPort } from '../domain/ports/fee-group-repository.port';
import type { StoreDefaultsPort } from '../domain/ports/store-defaults.port';
import type { TownDirectoryPort } from '../domain/ports/town-directory.port';
import type { TransactionPort } from '../domain/ports/transaction.port';
import { TenancyStoreDefaults } from './tenancy-store-defaults.adapter';
import { TransactionAdapter } from './transaction.adapter';
import { TypeOrmFeeGroupRepository } from './typeorm-fee-group.repository';

/** A use case built from the port bundle. */
const useCase = (type: new (ports: FeeGroupPorts) => object): Provider => ({
  provide: type,
  useFactory: (ports: FeeGroupPorts) => new type(ports),
  inject: [FEE_GROUP_PORTS],
});

/** Wires the fee-group use cases to their adapters; geo's town directory checks the communes (D3125). */
export const DELIVERY_PRICING_PROVIDERS: Provider[] = [
  { provide: FEE_GROUP_TRANSACTION, useClass: TransactionAdapter },
  { provide: STORE_DEFAULTS, useClass: TenancyStoreDefaults },
  { provide: TOWNS, useExisting: TOWN_DIRECTORY },
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
];
