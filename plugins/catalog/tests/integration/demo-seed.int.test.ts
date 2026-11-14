import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { toBusinessId, toStoreId } from '@cod/shared';
import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { RequestContextService } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DemoCatalogSeedService } from '../../application/demo-catalog-seed.service';
import { demoProductsFor } from '../../domain/demo-products';
import { asOperationContext } from '../../domain/ports/operation-context';
import { CatalogKit, createCatalogTestEnvironment, PRODUCTS } from './catalog-kit';

const { server, adminClient } = createCatalogTestEnvironment(1021, {
  plugins: [RbacPlugin],
  partitionedSchemas: [ACTIVITY_LOG_SCHEMA],
});
let kit: CatalogKit;
let fixtures: TwoBusinesses;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  kit = new CatalogKit(server.app, adminClient);
  fixtures = await createTwoBusinesses(adminClient);
});

afterAll(async () => {
  await server.destroy();
});

interface ListAnswer {
  readonly catalogProducts: { totalItems: number; items: { title: string }[] };
}

/**
 * Seeds business A's first store the way the server's demo seed does: a context in the store channel, without a
 * user, and the channel's own language (D2112, D2129).
 */
async function seedFirstStoreOfA(): Promise<{ readonly created: readonly string[]; readonly language: string }> {
  const { a } = fixtures;
  const [store] = a.stores;
  const ctx = await server.app
    .get(RequestContextService)
    .create({ apiType: 'admin', channelOrToken: store.channelToken });
  const language = ctx.channel.defaultLanguageCode;
  const scope = { businessId: toBusinessId(a.businessId), storeId: toStoreId(store.id) };
  const created = await server.app.get(DemoCatalogSeedService).seedStore(asOperationContext(ctx), scope, language);
  return { created, language };
}

async function titlesSeenBy(business: TwoBusinesses['a'], storeIndex: 0 | 1): Promise<string[]> {
  await kit.asOwner(business, business.stores[storeIndex]);
  const answer = await kit.gql<ListAnswer>(PRODUCTS, { options: { take: 100 } });
  return answer.catalogProducts.items.map((item) => item.title).sort();
}

describe('demo catalog seed on a store channel (D2129)', () => {
  it('creates the five demo products once, in the store language and only in that store', async () => {
    // Act
    const first = await seedFirstStoreOfA();
    const second = await seedFirstStoreOfA();

    // Assert
    const specs = demoProductsFor(first.language);
    expect(first.language).toBe('ar');
    expect(first.created).toEqual(specs.map((spec) => spec.sku));
    expect(second.created).toEqual([]);
    expect(await titlesSeenBy(fixtures.a, 0)).toEqual(specs.map((spec) => spec.title).sort());
    expect(await titlesSeenBy(fixtures.a, 1)).toEqual([]);
    expect(await titlesSeenBy(fixtures.b, 0)).toEqual([]);
  });
});
