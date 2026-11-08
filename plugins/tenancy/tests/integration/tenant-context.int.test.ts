import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import type { BusinessId, TenantContext } from '@cod/shared';
import { toBusinessId } from '@cod/shared';
import { Channel, RequestContextService, TransactionalConnection } from '@vendure/core';
import gql from 'graphql-tag';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ProvisionBusinessService, type ProvisionedBusiness } from '../../application/provision-business.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { BusinessEntity } from '../../infrastructure/business.entity';
import { StoreEntity } from '../../infrastructure/store.entity';
import { type TenantRepository, tenantQuery, TenantRepositoryFactory } from '../../infrastructure/tenant-repository';
import { TenancyPlugin } from '../../tenancy.plugin';
import { failureOf } from './graphql-outcome';
import { TenantProbePlugin } from './tenant-probe.plugin';

const OWNER_PASSWORD = 'synthetic-owner-password';
const UNUSED_CHANNEL_ID = 987_654;
const DEFAULT_CHANNEL = '__default_channel__';

const UPDATE_GLOBAL_LANGUAGES = gql`
  mutation {
    updateGlobalSettings(input: { availableLanguages: [ar, fr, en] }) {
      ... on GlobalSettings {
        id
      }
    }
  }
`;

const PROBE_FIELDS = 'businessId storeIds activeStoreId';
const TENANT_PROBE = gql`query { tenantProbe { ${PROBE_FIELDS} } }`;
const PUBLIC_PROBE = gql`query { publicTenantProbe { ${PROBE_FIELDS} } }`;
const TRANSACTION_PROBE = gql`query { tenantProbeInTransaction { ${PROBE_FIELDS} } }`;
const WITH_TRANSACTION_PROBE = gql`query { tenantProbeWithTransaction { ${PROBE_FIELDS} } }`;

describe('Tenant context', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [
      TenancyPlugin.init({ redisUrl: 'redis://unused', platformDomain: 'localhost', snowflakeWorkerId: 1001 }),
      TenantProbePlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });

  let alpha: ProvisionedBusiness;
  let bravo: ProvisionedBusiness;
  let stores: TenantRepository<StoreEntity>;
  let defaultChannelToken: string;

  const raw = () => server.app.get(TransactionalConnection).rawConnection;

  async function provision(slug: string): Promise<ProvisionedBusiness> {
    const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
    return server.app.get(ProvisionBusinessService).provision(asOperationContext(ctx), {
      name: `${slug} SARL`,
      owner: {
        emailAddress: `${slug}-owner@example.test`,
        firstName: slug,
        lastName: 'Owner',
        password: OWNER_PASSWORD,
      },
      store: { name: `${slug} store`, subdomain: slug, language: 'ar' },
    });
  }

  async function useStoreOf(provisioned: ProvisionedBusiness): Promise<void> {
    const { token } = await raw().getRepository(Channel).findOneByOrFail({ id: provisioned.store.channelId });
    adminClient.setChannelToken(token);
  }

  async function asOwnerOf(provisioned: ProvisionedBusiness, slug: string): Promise<void> {
    adminClient.setChannelToken(defaultChannelToken);
    await adminClient.asUserWithCredentials(`${slug}-owner@example.test`, OWNER_PASSWORD);
    await useStoreOf(provisioned);
  }

  const scopeOf = (provisioned: ProvisionedBusiness): { businessId: BusinessId } => ({
    businessId: toBusinessId(provisioned.business.id),
  });

  const expectedTenant = (provisioned: ProvisionedBusiness): TenantContext =>
    ({
      businessId: provisioned.business.id,
      storeIds: [provisioned.store.id],
      activeStoreId: provisioned.store.id,
    }) as unknown as TenantContext;

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    ({ token: defaultChannelToken } = await raw().getRepository(Channel).findOneByOrFail({ code: DEFAULT_CHANNEL }));
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    alpha = await provision('alpha');
    bravo = await provision('bravo');
    stores = server.app.get(TenantRepositoryFactory).for(StoreEntity);
  });

  afterEach(async () => {
    await raw().getRepository(BusinessEntity).update({ id: alpha.business.id }, { status: 'active' });
    await raw().getRepository(StoreEntity).update({ id: alpha.store.id }, { status: 'active' });
    adminClient.setChannelToken(defaultChannelToken);
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server.destroy();
  });

  describe('@TenantScoped', () => {
    it('forbids a request with no user', async () => {
      await adminClient.asAnonymousUser();

      const failure = await failureOf(adminClient.query(PUBLIC_PROBE));

      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('forbids the default channel, which never yields a tenant', async () => {
      const failure = await failureOf(adminClient.query(TENANT_PROBE));

      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('forbids an administrator with no business, even on a store channel', async () => {
      await useStoreOf(alpha);

      const failure = await failureOf(adminClient.query(TENANT_PROBE));

      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('gives an owner on their own store the tenant of that store', async () => {
      await asOwnerOf(alpha, 'alpha');

      const { tenantProbe } = await adminClient.query<{ tenantProbe: TenantContext }>(TENANT_PROBE);

      expect(tenantProbe).toEqual(expectedTenant(alpha));
    });

    it('forbids an owner on the store of another business', async () => {
      await asOwnerOf(alpha, 'alpha');
      await useStoreOf(bravo);

      const failure = await failureOf(adminClient.query(TENANT_PROBE));

      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('forbids the owner of a suspended business', async () => {
      await raw().getRepository(BusinessEntity).update({ id: alpha.business.id }, { status: 'suspended' });
      await asOwnerOf(alpha, 'alpha');

      const failure = await failureOf(adminClient.query(TENANT_PROBE));

      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('forbids an archived store', async () => {
      await raw().getRepository(StoreEntity).update({ id: alpha.store.id }, { status: 'archived' });
      await asOwnerOf(alpha, 'alpha');

      const failure = await failureOf(adminClient.query(TENANT_PROBE));

      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('keeps the tenant inside @Transaction, which copies the context', async () => {
      await asOwnerOf(alpha, 'alpha');

      const { tenantProbeInTransaction } = await adminClient.query<{ tenantProbeInTransaction: TenantContext }>(
        TRANSACTION_PROBE,
      );

      expect(tenantProbeInTransaction).toEqual(expectedTenant(alpha));
    });

    it('keeps the tenant inside withTransaction, which copies the context', async () => {
      await asOwnerOf(alpha, 'alpha');

      const { tenantProbeWithTransaction } = await adminClient.query<{ tenantProbeWithTransaction: TenantContext }>(
        WITH_TRANSACTION_PROBE,
      );

      expect(tenantProbeWithTransaction).toEqual(expectedTenant(alpha));
    });
  });

  describe('TenantRepository', () => {
    it('never finds a row of another business', async () => {
      const found = await stores.find(scopeOf(alpha), { where: { id: bravo.store.id } });
      const all = await stores.find(scopeOf(alpha), {});
      const alternatives = await stores.find(scopeOf(alpha), {
        where: [{ id: bravo.store.id }, { id: alpha.store.id }],
      });
      const one = await stores.findOne(scopeOf(alpha), { id: bravo.store.id });

      expect(found).toEqual([]);
      expect(all.map((row) => row.businessId)).toEqual([alpha.business.id]);
      expect(alternatives.map((row) => row.id)).toEqual([alpha.store.id]);
      expect(one).toBeNull();
    });

    it('ignores a businessId in the filter', async () => {
      const found = await stores.find(scopeOf(alpha), { where: { businessId: bravo.business.id } });
      const counted = await stores.count(scopeOf(alpha), { businessId: bravo.business.id });

      expect(found.map((row) => row.businessId)).toEqual([alpha.business.id]);
      expect(counted).toBe(1);
    });

    it('stores the business of the scope, whatever the row says', async () => {
      const id = '7000000000000000001';

      await stores.insert(scopeOf(alpha), {
        id,
        businessId: bravo.business.id,
        storeId: id,
        channelId: UNUSED_CHANNEL_ID,
        sellerId: alpha.business.sellerId,
        name: 'spoofed',
        language: 'ar',
        subdomain: 'spoofed',
        status: 'archived',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const row = await raw().getRepository(StoreEntity).findOneByOrFail({ id });
      expect(row.businessId).toBe(alpha.business.id);
      await raw().getRepository(StoreEntity).delete({ id });
    });

    it('updates nothing of another business and cannot move a row to one', async () => {
      const crossTenant = await stores.update(scopeOf(alpha), { id: bravo.store.id }, { name: 'stolen' });
      const moved = await stores.update(
        scopeOf(alpha),
        { id: alpha.store.id },
        { businessId: bravo.business.id, description: 'kept' },
      );

      const bravoRow = await raw().getRepository(StoreEntity).findOneByOrFail({ id: bravo.store.id });
      const alphaRow = await raw().getRepository(StoreEntity).findOneByOrFail({ id: alpha.store.id });
      expect(crossTenant).toBe(0);
      expect(bravoRow.name).toBe('bravo store');
      expect(moved).toBe(1);
      expect(alphaRow.businessId).toBe(alpha.business.id);
    });

    it('scopes a query builder, and a later where cannot replace the filter', async () => {
      const scoped = await tenantQuery(scopeOf(alpha), stores, 'store').getMany();
      const replaced = await tenantQuery(scopeOf(alpha), stores, 'store')
        .where('store.id = :id', { id: bravo.store.id })
        .getMany();

      expect(scoped.map((row) => row.id)).toEqual([alpha.store.id]);
      expect(replaced).toEqual([]);
    });

    it('refuses orWhere on a tenant query, which would widen it', () => {
      const query = tenantQuery(scopeOf(alpha), stores, 'store');

      expect(() => query.orWhere('store.id = :id', { id: bravo.store.id })).toThrow(/widen/);
    });
  });
});
