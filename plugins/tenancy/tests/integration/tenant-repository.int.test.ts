import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { type BusinessId, type TenantScope, toBusinessId } from '@cod/shared';
import { TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProvisionedBusiness } from '../../application/provision-business.service';
import {
  TenantQueryParameterReservedError,
  TenantQueryWidenedError,
  TenantQueryWriteRefusedError,
  TenantScopeMissingError,
} from '../../domain/errors';
import { StoreEntity } from '../../infrastructure/store.entity';
import { type TenantRepository, tenantQuery, TenantRepositoryFactory } from '../../infrastructure/tenant-repository';
import { TenancyPlugin } from '../../tenancy.plugin';
import { provisionBusiness, TEST_REDIS_URL, UPDATE_GLOBAL_LANGUAGES } from './tenant-fixtures';

const UNUSED_CHANNEL_ID = 987_654;
const NO_BUSINESS = {} as TenantScope;

describe('Tenant data access', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1002 })],
    db: loadPluginTestDbConfig(process.env),
  });

  let alpha: ProvisionedBusiness;
  let bravo: ProvisionedBusiness;
  let stores: TenantRepository<StoreEntity>;

  const raw = () => server.app.get(TransactionalConnection).rawConnection;

  const scopeOf = (provisioned: ProvisionedBusiness): { businessId: BusinessId } => ({
    businessId: toBusinessId(provisioned.business.id),
  });

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    alpha = await provisionBusiness(server.app, 'alpha');
    bravo = await provisionBusiness(server.app, 'bravo');
    stores = server.app.get(TenantRepositoryFactory).for(StoreEntity);
  });

  afterAll(async () => {
    await server.destroy();
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

    it('keeps an OR condition inside the tenant, through where and andWhere', async () => {
      // The other business's id goes last: unbracketed, `tenant AND a OR b` matches it through the bare `OR b`.
      const either = { a: alpha.store.id, b: bravo.store.id };

      const viaAnd = await tenantQuery(scopeOf(alpha), stores, 'store')
        .andWhere('store.id = :a OR store.id = :b', either)
        .getMany();
      const viaWhere = await tenantQuery(scopeOf(alpha), stores, 'store')
        .where('store.id = :a OR store.id = :b', either)
        .getMany();

      expect(viaAnd.map((row) => row.id)).toEqual([alpha.store.id]);
      expect(viaWhere.map((row) => row.id)).toEqual([alpha.store.id]);
    });

    it('keeps the lock on a clone', async () => {
      const clone = tenantQuery(scopeOf(alpha), stores, 'store').clone();

      const replaced = await clone.where('store.id = :id OR 1 = 1', { id: bravo.store.id }).getMany();

      expect(replaced.map((row) => row.id)).toEqual([alpha.store.id]);
      expect(() => tenantQuery(scopeOf(alpha), stores, 'store').clone().orWhere('1 = 1')).toThrow(
        TenantQueryWidenedError,
      );
    });

    it('still paginates and counts a locked query', async () => {
      const [rows, total] = await tenantQuery(scopeOf(alpha), stores, 'store').take(1).skip(0).getManyAndCount();

      expect(rows.map((row) => row.id)).toEqual([alpha.store.id]);
      expect(total).toBe(1);
    });

    it.each(['insert', 'update', 'delete', 'softDelete', 'restore', 'relation'] as const)(
      'refuses the %s builder, which would lose the filter',
      (method) => {
        const query = tenantQuery(scopeOf(alpha), stores, 'store') as unknown as Record<string, () => unknown>;

        expect(() => query[method]?.()).toThrow(TenantQueryWriteRefusedError);
      },
    );

    it('refuses a caller value for the tenant parameter', () => {
      const other = { tenantBusinessId: bravo.business.id };
      const query = (): ReturnType<typeof tenantQuery<StoreEntity>> => tenantQuery(scopeOf(alpha), stores, 'store');

      expect(() => query().setParameter('tenantBusinessId', bravo.business.id)).toThrow(
        TenantQueryParameterReservedError,
      );
      expect(() => query().setParameters(other)).toThrow(TenantQueryParameterReservedError);
      expect(() => query().andWhere('1 = 1', other)).toThrow(TenantQueryParameterReservedError);
    });

    it.each<[string, () => unknown]>([
      ['find', () => stores.find(NO_BUSINESS, {})],
      ['findOne', () => stores.findOne(NO_BUSINESS, {})],
      ['count', () => stores.count(NO_BUSINESS, {})],
      ['update', () => stores.update(NO_BUSINESS, {}, { name: 'x' })],
      ['insert', () => stores.insert(NO_BUSINESS, { name: 'x' })],
      ['query', () => tenantQuery(NO_BUSINESS, stores, 'store')],
    ])('fails closed on a scope with no business: %s', async (_name, call) => {
      await expect(Promise.resolve().then(call)).rejects.toThrow(TenantScopeMissingError);
    });
  });
});
