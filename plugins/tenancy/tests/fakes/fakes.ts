import type { StoreHostChange, StoreHostInvalidatorPort } from '../../domain/ports/store-host-invalidator.port';
import { type Snowflake, toSnowflake } from '@cod/shared';
import type { Business } from '../../domain/business';
import type {
  AdministratorRequest,
  ChannelProvisionerPort,
  ChannelRequest,
} from '../../domain/ports/channel-provisioner.port';
import type { AssetAccessPort } from '../../domain/ports/asset-access.port';
import type { IdGeneratorPort } from '../../domain/ports/id-generator.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { BusinessOwnerPatch, PlatformStorePort } from '../../domain/ports/platform-store.port';
import { TenantLifecycleRegistry } from '../../application/tenant-lifecycle.registry';
import type {
  BusinessProvisionedEvent,
  StoreCreatedEvent,
  TenantLifecycleHook,
} from '../../domain/ports/tenant-lifecycle.port';
import type { TransactionPort } from '../../domain/ports/transaction.port';
import type { Store, StoreAccess } from '../../domain/store';

/** Hands out `first`, `first + 1`, …, so a test knows every id in advance. */
export class SequentialIdGenerator implements IdGeneratorPort {
  private upcoming: bigint;

  constructor(first: string) {
    this.upcoming = BigInt(first);
  }

  next(): Snowflake {
    const id = toSnowflake(this.upcoming.toString());
    this.upcoming += 1n;
    return id;
  }
}

/** Records every call; `languages` is what the global settings offer. */
export class FakeChannelProvisioner implements ChannelProvisionerPort {
  readonly channels: ChannelRequest[] = [];
  readonly roleAssignments: { roleId: number; channelId: number }[] = [];
  readonly administrators: AdministratorRequest[] = [];
  calls = 0;

  constructor(private readonly languages: readonly string[] = ['ar', 'fr', 'en']) {}

  availableLanguages(): Promise<readonly string[]> {
    return Promise.resolve(this.languages);
  }

  createSeller(): Promise<number> {
    this.calls += 1;
    return Promise.resolve(70);
  }

  createOwnerRole(): Promise<number> {
    this.calls += 1;
    return Promise.resolve(80);
  }

  createChannel(_ctx: OperationContext, request: ChannelRequest): Promise<number> {
    this.calls += 1;
    this.channels.push(request);
    return Promise.resolve(90 + this.channels.length);
  }

  assignRoleToChannel(_ctx: OperationContext, roleId: number, channelId: number): Promise<void> {
    this.calls += 1;
    this.roleAssignments.push({ roleId, channelId });
    return Promise.resolve();
  }

  updateChannelLanguage(): Promise<void> {
    this.calls += 1;
    return Promise.resolve();
  }

  createAdministrator(_ctx: OperationContext, request: AdministratorRequest): Promise<number> {
    this.calls += 1;
    this.administrators.push(request);
    return Promise.resolve(60);
  }
}

/** Keeps rows in memory, like the unscoped platform adapter. */
export class InMemoryPlatformStore implements PlatformStorePort {
  readonly businesses = new Map<string, Business>();
  readonly stores: Store[] = [];
  readonly sequences: string[] = [];

  saveBusiness(_ctx: OperationContext, business: Business): Promise<void> {
    this.businesses.set(business.id, business);
    return Promise.resolve();
  }

  findBusiness(_ctx: OperationContext, id: Snowflake): Promise<Business | undefined> {
    return Promise.resolve(this.businesses.get(id));
  }

  updateBusinessOwner(_ctx: OperationContext, id: Snowflake, patch: BusinessOwnerPatch): Promise<void> {
    const business = this.businesses.get(id);
    if (business !== undefined) {
      this.businesses.set(id, { ...business, ...patch });
    }
    return Promise.resolve();
  }

  updateBusiness(): Promise<void> {
    return Promise.resolve();
  }

  lockBusiness(): Promise<void> {
    return Promise.resolve();
  }

  createOrderSequence(_ctx: OperationContext, businessId: Snowflake): Promise<void> {
    this.sequences.push(businessId);
    return Promise.resolve();
  }

  saveStore(_ctx: OperationContext, store: Store): Promise<void> {
    this.stores.push(store);
    return Promise.resolve();
  }

  findStoreAccess(_ctx: OperationContext, businessId: string): Promise<readonly StoreAccess[]> {
    return Promise.resolve(this.stores.filter((store) => store.businessId === businessId));
  }

  isSubdomainTaken(_ctx: OperationContext, subdomain: string): Promise<boolean> {
    return Promise.resolve(this.stores.some((store) => store.subdomain === subdomain));
  }
}

/** Every asset is available: logo ownership is covered by the integration tests. */
export const openAssets: AssetAccessPort = {
  isAssetInChannels: () => Promise.resolve(true),
};

/** Runs the work in place: unit tests have no database. */
export const inlineTransaction: TransactionPort = {
  run: (ctx, work) => work(ctx),
};

/** Records the order hooks ran in, and throws from `failAt` when given. */
export class RecordingLifecycleHook implements TenantLifecycleHook {
  constructor(
    private readonly name: string,
    private readonly journal: string[],
    private readonly failAt?: 'businessProvisioned' | 'storeCreated',
  ) {}

  businessProvisioned(_ctx: OperationContext, event: BusinessProvisionedEvent): Promise<void> {
    this.journal.push(
      `${this.name}:business:${event.businessId}:${String(event.ownerRoleId)}:${String(event.ownerAdministratorId)}`,
    );
    return this.failAt === 'businessProvisioned' ? Promise.reject(new Error(`${this.name} failed`)) : Promise.resolve();
  }

  storeCreated(_ctx: OperationContext, event: StoreCreatedEvent): Promise<void> {
    this.journal.push(`${this.name}:store:${event.storeId}:${String(event.channelId)}`);
    return this.failAt === 'storeCreated' ? Promise.reject(new Error(`${this.name} failed`)) : Promise.resolve();
  }
}

/** A lifecycle that nobody registered on. */
export const noLifecycle: TenantLifecycleHook = new TenantLifecycleRegistry();

/** Records every host invalidation, and can be told when the transaction it follows committed. */
export class RecordingHostInvalidator implements StoreHostInvalidatorPort {
  readonly changes: StoreHostChange[] = [];

  invalidate(change: StoreHostChange): Promise<void> {
    this.changes.push(change);
    return Promise.resolve();
  }
}
