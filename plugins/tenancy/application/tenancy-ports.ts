import type { AssetAccessPort } from '../domain/ports/asset-access.port';
import type { ChannelProvisionerPort } from '../domain/ports/channel-provisioner.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { PlatformStorePort } from '../domain/ports/platform-store.port';
import type { TransactionPort } from '../domain/ports/transaction.port';
import type { TenantLifecycleHook } from '../domain/ports/tenant-lifecycle.port';

/** The adapters and clock the tenancy use cases run on. */
export interface TenancyPorts {
  readonly channels: ChannelProvisionerPort;
  readonly assets: AssetAccessPort;
  readonly platform: PlatformStorePort;
  readonly transaction: TransactionPort;
  readonly ids: IdGeneratorPort;
  /** Told of new businesses and stores inside the transaction that makes them (D56). */
  readonly lifecycle: TenantLifecycleHook;
  readonly clock: () => Date;
}
