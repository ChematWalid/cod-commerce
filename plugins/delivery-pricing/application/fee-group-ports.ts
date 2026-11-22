import type { FeeGroupRepositoryPort } from '../domain/ports/fee-group-repository.port';
import type { StoreDefaultsPort } from '../domain/ports/store-defaults.port';
import type { TownDirectoryPort } from '../domain/ports/town-directory.port';
import type { TransactionPort } from '../domain/ports/transaction.port';

/** Every port the fee-group use cases run on, injected as one bundle. */
export interface FeeGroupPorts {
  readonly groups: FeeGroupRepositoryPort;
  readonly transaction: TransactionPort;
  readonly storeDefaults: StoreDefaultsPort;
  readonly towns: TownDirectoryPort;
}
