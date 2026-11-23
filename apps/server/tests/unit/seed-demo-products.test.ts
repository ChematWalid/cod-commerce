import { DemoCatalogSeedService, type DemoSeedExtras, demoCollectionsFor } from '@cod/plugin-catalog';
import { DemoCollectionSeedService, type DemoCollectionInput } from '@cod/plugin-collections-rules';
import { type BusinessId, toBusinessId, toStoreId } from '@cod/shared';
import type { INestApplicationContext } from '@nestjs/common';
import { ChannelService, type RequestContext, RequestContextService, type User } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import {
  DemoOwnerMissingError,
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
    expect(
      ports.seeded.map((target) => [target.businessId, target.store.id, target.store.channelId, target.ownerEmail]),
    ).toEqual([
      ['101', '1001', 11, 'owner@a.example.test'],
      ['202', '2001', 21, 'owner@b.example.test'],
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

/** An owner lookup answering `user` for any address. */
const ownerUser = (user: { id: number } | undefined) => (): Promise<User | undefined> =>
  Promise.resolve(user as User | undefined);

/** An app with the store's channel 11 and a context factory recording what it was asked. */
function contextApp() {
  const created: unknown[] = [];
  const services = new Map<unknown, unknown>([
    [ChannelService, { findOne: () => Promise.resolve({ id: 11 }) }],
    [
      RequestContextService,
      {
        create: (input: unknown) => {
          created.push(input);
          return Promise.reject(new Error('stop after the context'));
        },
      },
    ],
  ]);
  const app = { get: (token: unknown) => services.get(token) } as unknown as INestApplicationContext;
  return { app, created };
}

const target = {
  businessId: toBusinessId('101'),
  store: { id: toStoreId('1001'), channelId: 11 },
  ownerEmail: 'owner@a.example.test',
};

describe('demoProductSeedPorts', () => {
  it("runs the store's catalog as the business owner, whose reach includes the store's media", async () => {
    // Arrange
    const { app, created } = contextApp();
    const ports = demoProductSeedPorts(
      app,
      {} as RequestContext,
      () => Promise.resolve(undefined),
      ownerUser({ id: 7 }),
    );

    // Act
    await ports.seedStore(target).catch(() => undefined);

    // Assert
    expect(created).toEqual([{ apiType: 'admin', channelOrToken: { id: 11 }, user: { id: 7 } }]);
  });

  it('refuses a demo owner without a user with a typed error', async () => {
    // Arrange
    const { app } = contextApp();
    const ports = demoProductSeedPorts(
      app,
      {} as RequestContext,
      () => Promise.resolve(undefined),
      ownerUser(undefined),
    );

    // Act
    const seeding = ports.seedStore(target);

    // Assert
    await expect(seeding).rejects.toBeInstanceOf(DemoOwnerMissingError);
  });

  it('refuses a store whose channel does not exist with a typed error', async () => {
    // Arrange
    const channels = { findOne: () => Promise.resolve(undefined) };
    const app = {
      get: (token: unknown) => {
        if (token === ChannelService) return channels;
        throw new Error('unexpected service');
      },
    } as unknown as INestApplicationContext;
    const ports = demoProductSeedPorts(
      app,
      {} as RequestContext,
      () => Promise.resolve(undefined),
      ownerUser({ id: 7 }),
    );

    // Act
    const seeding = ports.seedStore({
      businessId: toBusinessId('101'),
      store: { id: toStoreId('1001'), channelId: 11 },
      ownerEmail: 'owner@a.example.test',
    });

    // Assert
    await expect(seeding).rejects.toBeInstanceOf(DemoStoreChannelMissingError);
    await expect(seeding).rejects.toThrow('The demo store channel 11 does not exist');
  });

  it('seeds the demo collections first, then the products with their images and those collections', async () => {
    // Arrange
    const asked: { collections?: readonly DemoCollectionInput[]; language?: string; extras?: DemoSeedExtras } = {};
    const collectionSeed = {
      ensureManual: (_ctx: unknown, _scope: unknown, inputs: readonly DemoCollectionInput[]) => {
        asked.collections = inputs;
        return Promise.resolve({ idsBySlug: new Map([['malabis', '41']]), created: ['malabis'] });
      },
    };
    const catalogSeed = {
      seedStore: (_ctx: unknown, _scope: unknown, language: string, extras: DemoSeedExtras) => {
        asked.language = language;
        asked.extras = extras;
        return Promise.resolve(['DEMO-TEE']);
      },
    };
    const services = new Map<unknown, unknown>([
      [ChannelService, { findOne: () => Promise.resolve({ id: 11 }) }],
      [RequestContextService, { create: () => Promise.resolve({ channel: { defaultLanguageCode: 'ar' } }) }],
      [DemoCollectionSeedService, collectionSeed],
      [DemoCatalogSeedService, catalogSeed],
    ]);
    const app = { get: (token: unknown) => services.get(token) } as unknown as INestApplicationContext;
    const ports = demoProductSeedPorts(
      app,
      {} as RequestContext,
      () => Promise.resolve(undefined),
      ownerUser({ id: 7 }),
    );

    // Act
    const created = await ports.seedStore({
      businessId: toBusinessId('101'),
      store: { id: toStoreId('1001'), channelId: 11 },
      ownerEmail: 'owner@a.example.test',
    });

    // Assert
    expect(created).toEqual(['malabis', 'DEMO-TEE']);
    expect(asked.collections?.map(({ slug }) => slug)).toEqual(demoCollectionsFor('ar').map(({ slug }) => slug));
    expect(asked.language).toBe('ar');
    expect(asked.extras?.collectionIdOf?.('apparel')).toBe('41');
    expect(asked.extras?.collectionIdOf?.('home')).toBeUndefined();
    expect([...(asked.extras?.imageOf?.('#000000') ?? []).slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
  });
});
