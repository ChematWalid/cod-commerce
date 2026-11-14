import {
  classifySubdomain,
  isPlatformLanguageCode,
  PLATFORM_LANGUAGE_CODES,
  type Snowflake,
  toBusinessId,
  toStoreId,
} from '@cod/shared';
import type { Business } from '../domain/business';
import {
  BusinessNotFoundError,
  BusinessOwnerRoleMissingError,
  LanguagesNotConfiguredError,
  SubdomainInvalidError,
  SubdomainTakenError,
  UnsupportedStoreLanguageError,
} from '../domain/errors';
import { assertValidName } from '../domain/name';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreHostInvalidatorPort } from '../domain/ports/store-host-invalidator.port';
import { type CreateStoreInput, newStore, type Store } from '../domain/store';
import { assertAssetInChannels, channelsOf } from './asset-rules';
import type { TenancyPorts } from './tenancy-ports';

/** Opens a store for a business: a channel of its seller, its Owner role on that channel, and the store row. */
export class CreateStoreService {
  constructor(
    private readonly ports: TenancyPorts,
    private readonly hosts: StoreHostInvalidatorPort,
  ) {}

  /**
   * Checks what can be checked without writing anything, and returns the normalised subdomain.
   *
   * @throws {NameInvalidError}, {SubdomainInvalidError}, {UnsupportedStoreLanguageError} or {LanguagesNotConfiguredError}.
   */
  async assertCreatable(ctx: OperationContext, input: CreateStoreInput): Promise<string> {
    assertValidName(input.name);
    const { status, subdomain, reason } = classifySubdomain(input.subdomain);
    if (status !== 'available') {
      throw new SubdomainInvalidError(reason ?? status);
    }
    if (!isPlatformLanguageCode(input.language)) {
      throw new UnsupportedStoreLanguageError(input.language);
    }
    const offered = await this.ports.channels.availableLanguages(ctx);
    if (!PLATFORM_LANGUAGE_CODES.every((code) => offered.includes(code))) {
      throw new LanguagesNotConfiguredError();
    }
    return subdomain;
  }

  /**
   * Creates the store in one transaction, so a failure leaves no orphan channel, then forgets its host.
   *
   * @throws what {@link assertCreatable} throws, {@link BusinessNotFoundError} or {@link SubdomainTakenError}.
   */
  async create(ctx: OperationContext, businessId: Snowflake, input: CreateStoreInput): Promise<Store> {
    const subdomain = await this.assertCreatable(ctx, input);
    const store = await this.ports.transaction.run(ctx, (transactional) =>
      this.createIn(transactional, businessId, subdomain, input),
    );
    await this.forgetHost(store);
    return store;
  }

  /**
   * Creates the store inside the caller's transaction. The caller calls {@link forgetHost} once it has committed.
   *
   * @param subdomain the normalised subdomain {@link assertCreatable} returned.
   * @throws {@link BusinessNotFoundError} or {@link SubdomainTakenError}.
   */
  async createIn(
    ctx: OperationContext,
    businessId: Snowflake,
    subdomain: string,
    input: CreateStoreInput,
  ): Promise<Store> {
    const business = await this.requireBusiness(ctx, businessId);
    if (await this.ports.platform.isSubdomainTaken(ctx, subdomain)) {
      throw new SubdomainTakenError();
    }
    await this.assertLogoAllowed(ctx, business, input);
    return this.openStore(ctx, business, subdomain, input);
  }

  /**
   * Drops any cached resolution of the new store's host. A subdomain is free as soon as a store leaves it, and an
   * entry that outlived its invalidation (retries ran out, or the process died between commit and delete) would
   * send the new store's buyers to the old store for up to a day (TEN-2).
   */
  async forgetHost(store: Pick<Store, 'id' | 'subdomain'>): Promise<void> {
    await this.hosts.invalidate({ storeId: store.id, subdomains: [store.subdomain] });
  }

  private async requireBusiness(ctx: OperationContext, businessId: Snowflake): Promise<Business> {
    const business = await this.ports.platform.findBusiness(ctx, businessId);
    if (business === undefined) {
      throw new BusinessNotFoundError();
    }
    return business;
  }

  /**
   * The new channel holds nothing yet, so a logo must come from a channel the business already has; {@link openStore}
   * then shares it with the new channel, the one `Store.logoUrl` and `updateStore` look at (D2120).
   */
  private async assertLogoAllowed(ctx: OperationContext, business: Business, input: CreateStoreInput): Promise<void> {
    if (input.logoAssetId === undefined) return;
    const stores = await this.ports.platform.findStoreAccess(ctx, toBusinessId(business.id));
    await assertAssetInChannels(this.ports.assets, ctx, input.logoAssetId, channelsOf(stores));
  }

  private async openStore(
    ctx: OperationContext,
    business: Business,
    subdomain: string,
    input: CreateStoreInput,
  ): Promise<Store> {
    if (business.ownerRoleId === null) {
      throw new BusinessOwnerRoleMissingError();
    }
    const { sellerId } = business;
    const channelId = await this.ports.channels.createChannel(ctx, { sellerId, language: input.language });
    await this.ports.channels.assignRoleToChannel(ctx, business.ownerRoleId, channelId);
    if (input.logoAssetId !== undefined) {
      await this.ports.assets.shareWithChannel(ctx, input.logoAssetId, channelId);
    }
    const store = newStore({
      id: toStoreId(this.ports.ids.next()),
      businessId: business.id,
      channelId,
      sellerId,
      subdomain,
      input,
      now: this.ports.clock(),
    });
    await this.ports.platform.saveStore(ctx, store);
    await this.ports.lifecycle.storeCreated(ctx, {
      businessId: toBusinessId(business.id),
      storeId: store.id,
      channelId,
    });
    return store;
  }
}
