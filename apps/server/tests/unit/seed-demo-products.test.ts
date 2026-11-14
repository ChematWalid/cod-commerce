import { type BusinessId, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { type DemoProductSeedPorts, type DemoStoreTarget, seedDemoProducts } from '../../src/seed/seed-demo-products';

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
