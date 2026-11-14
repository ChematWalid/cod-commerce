import { type BusinessId, toBusinessId, toStoreId } from '@cod/shared';
import type { INestApplicationContext } from '@nestjs/common';
import { ChannelService, type RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import {
  DemoStoreChannelMissingError,
  type DemoProductSeedPorts,
  type DemoStoreTarget,
  demoProductSeedPorts,
  seedDemoProducts,
} from '../../src/seed/seed-demo-products';

/** Two businesses whose stores the directory lists newest first, and a recorder of what was seeded. */
function fakePorts(): DemoProductSeedPorts & { readonly seeded: DemoStoreTarget[] } {
  const businesses = new Map([
    ['owner@a.example.test', '101'],
    ['owner@b.example.test', '202'],
  ]);
  const stores = new Map([
    [
      '101',
      [
        { id: toStoreId('1002'), channelId: 12 },
        { id: toStoreId('1001'), channelId: 11 },
      ],
    ],
    ['202', [{ id: toStoreId('2001'), channelId: 21 }]],
  ]);
  const seeded: DemoStoreTarget[] = [];
  return {
    seeded,
    businessOf: (email) => Promise.resolve(businesses.get(email)),
    storesOf: (businessId: BusinessId) => Promise.resolve(stores.get(businessId) ?? []),
    seedStore: (target) => {
      seeded.push(target);
      return Promise.resolve([`SKU-${target.store.id}`]);
    },
  };
}

describe('seedDemoProducts', () => {
  it('seeds the first store of each demo business', async () => {
    // Arrange
    const ports = fakePorts();

    // Act
    const created = await seedDemoProducts(ports, ['owner@a.example.test', 'owner@b.example.test']);

    // Assert
    expect(ports.seeded.map((target) => [target.businessId, target.store.id, target.store.channelId])).toEqual([
      ['101', '1001', 11],
      ['202', '2001', 21],
    ]);
    expect(created).toEqual(['SKU-1001', 'SKU-2001']);
  });

  it('skips an owner without a business and a business without a store', async () => {
    // Arrange
    const ports = { ...fakePorts(), storesOf: () => Promise.resolve([]) };

    // Act
    const created = await seedDemoProducts(ports, ['missing@example.test', 'owner@a.example.test']);

    // Assert
    expect(created).toEqual([]);
  });
});

describe('demoProductSeedPorts', () => {
  it('refuses a store whose channel does not exist with a typed error', async () => {
    // Arrange
    const channels = { findOne: () => Promise.resolve(undefined) };
    const app = {
      get: (token: unknown) => {
        if (token === ChannelService) return channels;
        throw new Error('unexpected service');
      },
    } as unknown as INestApplicationContext;
    const ports = demoProductSeedPorts(app, {} as RequestContext, () => Promise.resolve(undefined));

    // Act
    const seeding = ports.seedStore({
      businessId: toBusinessId('101'),
      store: { id: toStoreId('1001'), channelId: 11 },
    });

    // Assert
    await expect(seeding).rejects.toBeInstanceOf(DemoStoreChannelMissingError);
    await expect(seeding).rejects.toThrow('The demo store channel 11 does not exist');
  });
});
