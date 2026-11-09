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
import { type CreateStoreInput, newStore, type Store } from '../domain/store';
import { assertAssetInChannels, channelsOf } from './asset-rules';
import type { TenancyPorts } from './tenancy-ports';

/** Opens a store for a business: a channel of its seller, its Owner role on that channel, and the store row. */
export class CreateStoreService {
  constructor(private readonly ports: TenancyPorts) {}

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
   * Creates the store in one transaction, so a failure leaves no orphan channel.
   *
   * @throws what {@link assertCreatable} throws, {@link BusinessNotFoundError} or {@link SubdomainTakenError}.
   */
  async create(ctx: OperationContext, businessId: Snowflake, input: CreateStoreInput): Promise<Store> {
    const subdomain = await this.assertCreatable(ctx, input);
    return this.ports.transaction.run(ctx, async (transactional) => {
      const business = await this.requireBusiness(transactional, businessId);
      if (await this.ports.platform.isSubdomainTaken(transactional, subdomain)) {
        throw new SubdomainTakenError();
      }
      await this.assertLogoAllowed(transactional, business, input);
      return this.openStore(transactional, business, subdomain, input);
    });
  }

  private async requireBusiness(ctx: OperationContext, businessId: Snowflake): Promise<Business> {
    const business = await this.ports.platform.findBusiness(ctx, businessId);
    if (business === undefined) {
      throw new BusinessNotFoundError();
    }
    return business;
  }

  /** The new channel holds nothing yet, so a logo must come from a channel the business already has. */
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
