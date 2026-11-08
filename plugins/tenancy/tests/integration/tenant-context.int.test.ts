import { createPluginTestEnvironment, failureOf, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import type { TenantContext } from '@cod/shared';
import { Channel, TransactionalConnection } from '@vendure/core';
import gql from 'graphql-tag';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ProvisionedBusiness } from '../../application/provision-business.service';
import { BusinessEntity } from '../../infrastructure/business.entity';
import { StoreEntity } from '../../infrastructure/store.entity';
import { TenancyPlugin } from '../../tenancy.plugin';
import { TenantProbePlugin } from './tenant-probe.plugin';
import { OWNER_PASSWORD, provisionBusiness, TEST_REDIS_URL, UPDATE_GLOBAL_LANGUAGES } from './tenant-fixtures';

const DEFAULT_CHANNEL = '__default_channel__';

const PROBE_FIELDS = 'businessId storeIds activeStoreId';
const TENANT_PROBE = gql`query { tenantProbe { ${PROBE_FIELDS} } }`;
const PUBLIC_PROBE = gql`query { publicTenantProbe { ${PROBE_FIELDS} } }`;
const TRANSACTION_PROBE = gql`query { tenantProbeInTransaction { ${PROBE_FIELDS} } }`;
const WITH_TRANSACTION_PROBE = gql`query { tenantProbeWithTransaction { ${PROBE_FIELDS} } }`;

describe('Tenant context', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1001 }),
      TenantProbePlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });

  let alpha: ProvisionedBusiness;
  let bravo: ProvisionedBusiness;
  let defaultChannelToken: string;

  const raw = () => server.app.get(TransactionalConnection).rawConnection;

  const provision = (slug: string): Promise<ProvisionedBusiness> => provisionBusiness(server.app, slug);

  async function useStoreOf(provisioned: ProvisionedBusiness): Promise<void> {
    const { token } = await raw().getRepository(Channel).findOneByOrFail({ id: provisioned.store.channelId });
    adminClient.setChannelToken(token);
  }

  async function asOwnerOf(provisioned: ProvisionedBusiness, slug: string): Promise<void> {
    adminClient.setChannelToken(defaultChannelToken);
    await adminClient.asUserWithCredentials(`${slug}-owner@example.test`, OWNER_PASSWORD);
    await useStoreOf(provisioned);
  }

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

    it.each(['bravo', 'default'])(
      'resolves no tenant for an owner on the %s channel, even on a public handler',
      async (channel) => {
        await asOwnerOf(alpha, 'alpha');
        if (channel === 'bravo') await useStoreOf(bravo);
        else adminClient.setChannelToken(defaultChannelToken);

        const failure = await failureOf(adminClient.query(PUBLIC_PROBE));

        expect(failure.codes).toEqual(['FORBIDDEN']);
      },
    );

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
});
