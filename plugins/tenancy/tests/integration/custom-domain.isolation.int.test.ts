import { type TenantScope, toBusinessId } from '@cod/shared';
import {
  type BusinessFixture,
  createPluginTestEnvironment,
  createTwoBusinesses,
  loadPluginTestDbConfig,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CustomDomainEntity } from '../../infrastructure/custom-domain.entity';
import { PlatformStoreLookup } from '../../infrastructure/platform-store-lookup';
import { type TenantRepository, TenantRepositoryFactory } from '../../infrastructure/tenant-repository';
import { tenancyTestPlugins } from './tenant-fixtures';

const DOMAIN_OF_A = { id: '7100000000000000001', host: 'a-shop.example.test' };
const DOMAIN_OF_B = { id: '7100000000000000002', host: 'b-shop.example.test' };
const HIJACKED_HOST = 'hijacked.example.test';

describe('custom_domain isolation', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: tenancyTestPlugins(1012),
    db: loadPluginTestDbConfig(process.env),
  });
  let fixtures: TwoBusinesses;
  let domains: TenantRepository<CustomDomainEntity>;

  const scopeOf = (business: BusinessFixture): TenantScope => ({
    businessId: toBusinessId(business.businessId),
  });

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    fixtures = await createTwoBusinesses(adminClient);
    domains = server.app.get(TenantRepositoryFactory).for(CustomDomainEntity);
    const verifiedAt = new Date();
    await domains.insert(scopeOf(fixtures.a), { ...DOMAIN_OF_A, storeId: fixtures.a.stores[0].id, verifiedAt });
    await domains.insert(scopeOf(fixtures.b), { ...DOMAIN_OF_B, storeId: fixtures.b.stores[0].id, verifiedAt });
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('never reads a domain row of another business', async () => {
    // Act
    const byId = await domains.findOne(scopeOf(fixtures.a), { id: DOMAIN_OF_B.id });
    const byHost = await domains.find(scopeOf(fixtures.a), { where: { host: DOMAIN_OF_B.host } });
    const all = await domains.find(scopeOf(fixtures.a));

    // Assert
    expect(byId).toBeNull();
    expect(byHost).toEqual([]);
    expect(all.map((row) => row.id)).toEqual([DOMAIN_OF_A.id]);
  });

  it('never updates a domain row of another business', async () => {
    // Act
    const affected = await domains.update(scopeOf(fixtures.a), { id: DOMAIN_OF_B.id }, { host: HIJACKED_HOST });

    // Assert
    const row = await domains.findOne(scopeOf(fixtures.b), { id: DOMAIN_OF_B.id });
    expect(affected).toBe(0);
    expect(row?.host).toBe(DOMAIN_OF_B.host);
    expect(row?.businessId).toBe(fixtures.b.businessId);
  });

  it('maps each host to its own store (positive control)', async () => {
    // Arrange
    const lookup = server.app.get(PlatformStoreLookup);

    // Act
    const ofA = await lookup.findByCustomDomain(DOMAIN_OF_A.host);
    const ofB = await lookup.findByCustomDomain(DOMAIN_OF_B.host);

    // Assert
    expect(ofA).toMatchObject({ storeId: fixtures.a.stores[0].id, businessId: fixtures.a.businessId });
    expect(ofB).toMatchObject({ storeId: fixtures.b.stores[0].id, businessId: fixtures.b.businessId });
  });
});
