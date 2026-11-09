import { describe, expect, it } from 'vitest';
import { CreateStoreService } from '../../application/create-store.service';
import { ProvisionBusinessService } from '../../application/provision-business.service';
import { SubdomainInvalidError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context';
import {
  FakeChannelProvisioner,
  InMemoryPlatformStore,
  openAssets,
  inlineTransaction,
  noLifecycle,
  SequentialIdGenerator,
} from '../fakes/fakes';

const ctx = asOperationContext({});
const NOW = new Date('2026-11-08T10:00:00Z');
const OWNER = { emailAddress: 'owner@example.test', firstName: 'Amina', lastName: 'B', password: 'synthetic-pass' };
const COMMAND = { name: 'Atlas SARL', owner: OWNER, store: { name: 'Atlas', subdomain: 'atlas', language: 'fr' } };

function setUp(): {
  service: ProvisionBusinessService;
  provisioner: FakeChannelProvisioner;
  platform: InMemoryPlatformStore;
} {
  const provisioner = new FakeChannelProvisioner();
  const platform = new InMemoryPlatformStore();
  const ports = {
    channels: provisioner,
    platform,
    transaction: inlineTransaction,
    ids: new SequentialIdGenerator('100'),
    assets: openAssets,
    lifecycle: noLifecycle,
    clock: (): Date => NOW,
  };
  const service = new ProvisionBusinessService(ports, new CreateStoreService(ports));
  return { service, provisioner, platform };
}

describe('ProvisionBusinessService', () => {
  it('links the seller, role, store, sequence and owner of a new business', async () => {
    // Arrange
    const { service, provisioner, platform } = setUp();

    // Act
    const result = await service.provision(ctx, COMMAND);

    // Assert
    expect(result.administratorId).toBe(60);
    expect(result.business).toMatchObject({
      sellerId: 70,
      ownerRoleId: 80,
      ownerAdministratorId: 60,
      status: 'active',
    });
    expect(result.store).toMatchObject({ businessId: result.business.id, channelId: 91, sellerId: 70 });
    expect(platform.businesses.get(result.business.id)).toEqual(result.business);
    expect(platform.sequences).toEqual([result.business.id]);
    expect(provisioner.administrators).toEqual([{ ...OWNER, roleId: 80, businessId: result.business.id }]);
  });

  it('provisions nothing for an invalid subdomain', async () => {
    // Arrange
    const { service, provisioner, platform } = setUp();

    // Act
    const provisioning = service.provision(ctx, { ...COMMAND, store: { ...COMMAND.store, subdomain: 'www' } });

    // Assert
    await expect(provisioning).rejects.toBeInstanceOf(SubdomainInvalidError);
    expect(provisioner.calls).toBe(0);
    expect(platform.businesses.size).toBe(0);
  });
});
