import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { demoCollectionsFor, demoProductsFor } from '@cod/plugin-catalog';
import {
  asOperationContext,
  ProvisionBusinessService,
  type ProvisionedBusiness,
  StorefrontStoreGuard,
} from '@cod/plugin-tenancy';
import { storefrontProductPageSchema } from '@cod/shared';
import { parseInternalKeys, type InternalSigningKey } from '@cod/shared/internal-auth';
import {
  AssetServerPlugin,
  defaultAssetStorageStrategyFactory,
  PresetOnlyStrategy,
} from '@vendure/asset-server-plugin';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { STOREFRONT_ISOLATION_CASES, type StorefrontHoldings } from '../isolation/cases/storefront-catalog';
import { runStorefrontMatrix, type StorefrontOutcome, storefrontHeadersOf } from '../isolation/storefront-run';
import { P3_TENANT_TABLES, tenantRowCounts } from '../isolation/tenant-tables';
import { ASSET_KEY_PREFIX, ASSET_ROUTE } from '../../src/config/asset-storage.config';
import { PrefixedAssetStorage } from '../../src/config/prefixed-asset-storage';
import { TenantAssetNamingStrategy } from '../../src/config/tenant-asset-naming.strategy';
import { demoProductSeedPorts, seedDemoProducts } from '../../src/seed/seed-demo-products';
import { demoOwnerUserOf } from '../../src/seed/seed-demo-businesses';
import { afterE2eInit, buildE2eConfig, E2E_INITIAL_DATA, e2eBullPrefix, removeBullKeys } from './support/e2e-config';
import { E2E_PORTS } from './support/ports';
import { type RawResponse, sendRaw } from './support/signed-request';

const SUITE = 'p3-isolation';
const PORT = E2E_PORTS.p3Isolation;
/** Synthetic: the internal-only middleware of this file verifies with these, whatever the shell holds. */
const KEYS = 'k1:synthetic-p3-isolation-secret-00000000000000';
const KEY = parseInternalKeys(KEYS)[0] as InternalSigningKey;
const ENV = { INTERNAL_HMAC_KEYS: KEYS, INTERNAL_HMAC_ACTIVE_KID: 'k1', PLATFORM_DOMAIN: 'localhost' };
const PASSWORD = 'synthetic-p3-isolation-password';
/** The projection is fed by the outbox (D3205): the world waits for each store's listed products to arrive. */
const PROJECTION_WAIT_MS = 120_000;
const POLL_MS = 500;
const SEED_TIMEOUT_MS = 600_000;

const UPDATE_GLOBAL_LANGUAGES = gql`
  mutation {
    updateGlobalSettings(input: { availableLanguages: [ar, fr, en] }) {
      ... on GlobalSettings {
        id
      }
    }
  }
`;

/** The two businesses of the world: A's first store is Arabic, B's French, as on the demo seed (P3.S2). */
const BUSINESSES = [
  { label: 'A', language: 'ar' },
  { label: 'B', language: 'fr' },
] as const;

/** The products the demo seed lists on a store of `language`: every active one. */
const listedNamesOf = (language: string): string[] =>
  demoProductsFor(language)
    .filter((spec) => spec.status === 'active')
    .map((spec) => spec.title);

/**
 * The P3.S2 isolation criterion as a test: two businesses get the demo catalog through the server's own seed (an
 * Arabic store and a French one, with images and collections), their products reach the storefront projection, and
 * each store's signed storefront calls reach for the other's products, slugs, collections and search terms, and for a
 * store named by an unsigned or forged `x-store-id`. An unsigned store header must never reach `StorefrontStoreGuard`
 * (the middleware answers first, D111): the guard is counted around every call.
 */
describe('P3 isolation: a store serves only its own storefront catalog', () => {
  const { server, adminClient } = createTestEnvironment(buildE2eConfig({}, { suite: SUITE, port: PORT, env: ENV }));
  // CI's integration job runs no Garage: the seeded images go to a local folder, under the production prefix and naming.
  AssetServerPlugin.init({
    route: ASSET_ROUTE,
    assetUploadDir: mkdtempSync(join(tmpdir(), 'cod-p3-isolation-assets-')),
    namingStrategy: new TenantAssetNamingStrategy(),
    imageTransformStrategy: new PresetOnlyStrategy({ defaultPreset: 'medium' }),
    storageStrategyFactory: (options) =>
      new PrefixedAssetStorage(defaultAssetStorageStrategyFactory(options), ASSET_KEY_PREFIX),
  });
  const guard = vi.spyOn(StorefrontStoreGuard.prototype, 'canActivate');
  const sql = () => server.app.get(TransactionalConnection).rawConnection;
  const send = (call: Parameters<typeof storefrontHeadersOf>[1]): Promise<RawResponse> =>
    sendRaw({
      port: PORT,
      method: 'GET',
      path: call.path,
      host: 'api.localhost',
      headers: storefrontHeadersOf(KEY, call),
    });
  const signedGet = (path: string, storeId: string): Promise<RawResponse> =>
    send({ path, signing: { kind: 'signed', storeId } });
  const provisioned = new Map<'A' | 'B', ProvisionedBusiness>();
  /** Each owner's address and business, as the seed's owner lookup answers them. */
  const businessByOwner = new Map<string, string>();
  const holdings = {} as Record<'A' | 'B', StorefrontHoldings>;
  let seedRuns: { first: readonly string[]; second: readonly string[] };
  let outcomes: StorefrontOutcome[];

  async function provision(label: 'A' | 'B', language: string, suffix: string): Promise<ProvisionedBusiness> {
    const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
    const emailAddress = `p3-${label.toLowerCase()}-${suffix}@example.test`;
    const business = await server.app.get(ProvisionBusinessService).provision(asOperationContext(ctx), {
      name: `P3 ${label}`,
      owner: { emailAddress, firstName: label, lastName: 'Owner', password: PASSWORD },
      store: { name: `P3 Store ${label}`, subdomain: `p3${label.toLowerCase()}${suffix}`, language },
    });
    businessByOwner.set(emailAddress, business.business.id);
    return business;
  }

  async function seed(): Promise<readonly string[]> {
    const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
    const ports = demoProductSeedPorts(
      server.app,
      ctx,
      (email) => Promise.resolve(businessByOwner.get(email)),
      (email) => demoOwnerUserOf(server.app, email),
    );
    return seedDemoProducts(ports, [...businessByOwner.keys()]);
  }

  /** Polls the signed list of `storeId` until it lists every name of `language`'s demo catalog. */
  async function listedOnce(storeId: string, language: string): Promise<RawResponse> {
    const expected = listedNamesOf(language);
    const deadline = Date.now() + PROJECTION_WAIT_MS;
    let answer = await signedGet('/store/products?take=50', storeId);
    while (expected.some((name) => !answer.body.includes(name)) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      answer = await signedGet('/store/products?take=50', storeId);
    }
    return answer;
  }

  async function holdingsOf(business: ProvisionedBusiness, language: string): Promise<StorefrontHoldings> {
    const page = storefrontProductPageSchema.parse(JSON.parse((await listedOnce(business.store.id, language)).body));
    const dress = demoProductsFor(language).find((spec) => spec.sku === 'DEMO-DRESS');
    const product = page.items.find((item) => item.name === dress?.title);
    if (product === undefined) throw new Error(`the ${language} store never listed its demo dress`);
    return {
      storeId: business.store.id,
      names: listedNamesOf(language),
      productSlug: product.slug,
      productName: product.name,
      searchTerm: product.name.split(' ')[0] ?? product.name,
      collectionSlug: demoCollectionsFor(language)[0]?.slug ?? '',
    };
  }

  beforeAll(async () => {
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
    await afterE2eInit(server);
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    const suffix = randomBytes(3).toString('hex');
    for (const { label, language } of BUSINESSES) provisioned.set(label, await provision(label, language, suffix));
    seedRuns = { first: await seed(), second: await seed() };
    for (const { label, language } of BUSINESSES) {
      holdings[label] = await holdingsOf(provisioned.get(label) as ProvisionedBusiness, language);
    }
    outcomes = await runStorefrontMatrix(
      { send, guardCalls: () => guard.mock.calls.length },
      STOREFRONT_ISOLATION_CASES,
      holdings,
    );
  }, SEED_TIMEOUT_MS);

  afterAll(async () => {
    guard.mockRestore();
    await server.destroy();
    await removeBullKeys(e2eBullPrefix(SUITE));
  });

  it('seeds both demo catalogs once through the server seed: collections and products, then nothing', () => {
    // Assert
    for (const { language } of BUSINESSES) {
      for (const { slug } of demoCollectionsFor(language)) expect(seedRuns.first).toContain(slug);
    }
    expect(seedRuns.first.filter((created) => created === 'DEMO-DRESS')).toHaveLength(2);
    expect(seedRuns.second).toEqual([]);
  });

  it('lists every seeded product of each store with its image', async () => {
    for (const { label, language } of BUSINESSES) {
      // Act
      const answer = await signedGet('/store/products?take=50', holdings[label].storeId);

      // Assert
      const page = storefrontProductPageSchema.parse(JSON.parse(answer.body));
      expect(page.items.map((item) => item.name).sort(), label).toEqual(listedNamesOf(language).sort());
      expect(
        page.items.every((item) => item.imagePath !== null),
        label,
      ).toBe(true);
    }
  });

  it.each(STOREFRONT_ISOLATION_CASES.flatMap((testCase) => [`${testCase.id} (A→B)`, `${testCase.id} (B→A)`]))(
    '%s',
    (run) => {
      // Arrange
      const outcome = outcomes.find(
        (candidate) => `${candidate.case.id} (${candidate.attacker}→${candidate.attacker === 'A' ? 'B' : 'A'})` === run,
      );

      // Assert
      expect(
        outcome?.failures,
        `${run}: HTTP ${String(outcome?.answer.status)} ${outcome?.answer.body.slice(0, 400) ?? ''}`,
      ).toEqual([]);
    },
  );

  it('seeds a row of each business in every storefront tenant table', async () => {
    // Act
    const counts = await tenantRowCounts(
      sql(),
      [provisioned.get('A')?.business.id ?? '', provisioned.get('B')?.business.id ?? ''],
      P3_TENANT_TABLES,
    );

    // Assert
    const empty = P3_TENANT_TABLES.filter((table) => (counts[table]?.a ?? 0) === 0 || (counts[table]?.b ?? 0) === 0);
    expect(empty).toEqual([]);
  });
});
