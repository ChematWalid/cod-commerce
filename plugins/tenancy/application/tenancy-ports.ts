import type { AssetAccessPort } from '../domain/ports/asset-access.port';
import type { ChannelProvisionerPort } from '../domain/ports/channel-provisioner.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { PlatformStorePort } from '../domain/ports/platform-store.port';
import type { TransactionPort } from '../domain/ports/transaction.port';

/** The adapters and clock the tenancy use cases run on. */
export interface TenancyPorts {
  readonly channels: ChannelProvisionerPort;
  readonly assets: AssetAccessPort;
  readonly platform: PlatformStorePort;
  readonly transaction: TransactionPort;
  readonly ids: IdGeneratorPort;
  readonly clock: () => Date;
}
