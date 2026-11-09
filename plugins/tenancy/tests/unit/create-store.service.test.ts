import { toSnowflake } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateStoreService } from '../../application/create-store.service';
import type { Business } from '../../domain/business';
import {
  BusinessNotFoundError,
  LanguagesNotConfiguredError,
  SubdomainInvalidError,
  SubdomainTakenError,
  UnsupportedStoreLanguageError,
} from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context';
import {
  FakeChannelProvisioner,
  InMemoryPlatformStore,
  openAssets,
  inlineTransaction,
  SequentialIdGenerator,
} from '../fakes/fakes';

const ctx = asOperationContext({});
const NOW = new Date('2026-11-08T10:00:00Z');
const BUSINESS_ID = toSnowflake('100');
const INPUT = { name: 'Atlas', subdomain: 'atlas', language: 'ar' };

const business: Business = {
  id: BUSINESS_ID,
  name: 'Atlas SARL',
  logoAssetId: null,
  onboardingState: {},
  ownerAdministratorId: null,
  sellerId: 7,
  ownerRoleId: 8,
  planId: null,
  status: 'active',
  createdAt: NOW,
};

describe('CreateStoreService', () => {
  let provisioner: FakeChannelProvisioner;
  let platform: InMemoryPlatformStore;

  const serviceWith = (channels: FakeChannelProvisioner): CreateStoreService =>
    new CreateStoreService({
      channels,
      platform,
      transaction: inlineTransaction,
      ids: new SequentialIdGenerator('500'),
      assets: openAssets,
      clock: () => NOW,
    });

  beforeEach(() => {
    provisioner = new FakeChannelProvisioner();
    platform = new InMemoryPlatformStore();
    platform.businesses.set(BUSINESS_ID, business);
  });

  it('asks for a channel with the seller and language of the business', async () => {
    // Act
    const store = await serviceWith(provisioner).create(ctx, BUSINESS_ID, INPUT);

    // Assert
    expect(provisioner.channels).toEqual([{ sellerId: 7, language: 'ar' }]);
    expect(provisioner.roleAssignments).toEqual([{ roleId: 8, channelId: 91 }]);
    expect(store).toMatchObject({
      id: '500',
      businessId: BUSINESS_ID,
      storeId: '500',
      channelId: 91,
      sellerId: 7,
      name: 'Atlas',
      description: '',
      subdomain: 'atlas',
      language: 'ar',
      showAddressField: true,
      soldOutBehavior: 'keep',
      status: 'active',
    });
    expect(platform.stores).toEqual([store]);
  });

  it('stores the subdomain in lowercase', async () => {
    // Act
    const store = await serviceWith(provisioner).create(ctx, BUSINESS_ID, { ...INPUT, subdomain: ' AtLas ' });

    // Assert
    expect(store.subdomain).toBe('atlas');
  });

  it.each(['www', 'a', 'not valid'])('refuses the subdomain "%s" before any provisioning', async (subdomain) => {
    // Act
    const creating = serviceWith(provisioner).create(ctx, BUSINESS_ID, { ...INPUT, subdomain });

    // Assert
    await expect(creating).rejects.toBeInstanceOf(SubdomainInvalidError);
    expect(provisioner.calls).toBe(0);
  });

  it('refuses a subdomain another store holds', async () => {
    // Arrange
    await serviceWith(provisioner).create(ctx, BUSINESS_ID, INPUT);
    const callsAfterFirst = provisioner.calls;

    // Act
    const creating = serviceWith(provisioner).create(ctx, BUSINESS_ID, INPUT);

    // Assert
    await expect(creating).rejects.toBeInstanceOf(SubdomainTakenError);
    expect(provisioner.calls).toBe(callsAfterFirst);
  });

  it('refuses when a platform language is missing from the global settings', async () => {
    // Arrange
    const channels = new FakeChannelProvisioner(['en']);

    // Act
    const creating = serviceWith(channels).create(ctx, BUSINESS_ID, { ...INPUT, language: 'en' });

    // Assert
    await expect(creating).rejects.toBeInstanceOf(LanguagesNotConfiguredError);
    expect(channels.calls).toBe(0);
  });

  it('refuses a language the platform does not offer', async () => {
    // Act
    const creating = serviceWith(provisioner).create(ctx, BUSINESS_ID, { ...INPUT, language: 'de' });

    // Assert
    await expect(creating).rejects.toBeInstanceOf(UnsupportedStoreLanguageError);
    expect(provisioner.calls).toBe(0);
  });

  it('refuses an unknown business', async () => {
    // Act
    const creating = serviceWith(provisioner).create(ctx, toSnowflake('999'), INPUT);

    // Assert
    await expect(creating).rejects.toBeInstanceOf(BusinessNotFoundError);
    expect(provisioner.calls).toBe(0);
  });
});
