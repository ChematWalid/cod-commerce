import { randomBytes } from 'node:crypto';
import { type StoreId, toBusinessId, toStoreId, vendurePermissionName } from '@cod/shared';
import {
  type CredentialsFixture,
  createMember,
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_INITIAL_DATA,
  type StoreFixture,
  type TwoBusinesses,
} from '@cod/testing';
import { RequestContextService } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ActivityLogService } from '../../application/activity-log.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { ACTIVITY_LOG_QUERY, type Page } from './activity-kit';
import { CANCEL_ORDER, CREATE_STORE } from './built-in-roles-kit';
import { type AccessAnswer, type AccessInput, AccessRows, ARCHIVE_STORE, SET_ACCESS } from './member-access-kit';
import { actAsInNewSession } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';

const SNOWFLAKE_WORKER_ID = 1018;
const VIEW_LOG = vendurePermissionName('settings.activity-log.view');

describe('store-scoped member access', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  let businesses: TwoBusinesses;
  let rows: AccessRows;
  let orderManagerRole: string;
  let storeOne: StoreFixture;
  let storeTwo: StoreFixture;
  let counter = 0;

  const member = async (
    permissions: readonly string[] = ['Authenticated'],
  ): Promise<{ credentials: CredentialsFixture; id: string }> => {
    counter += 1;
    const credentials = await createMember(server.app, adminClient, {
      code: `scope-${String(counter)}`,
      business: businesses.a,
      store: storeOne,
      permissions,
    });
    return { credentials, id: await rows.administratorId(credentials) };
  };

  const set = (input: AccessInput): Promise<AccessAnswer> => adminClient.query<AccessAnswer>(SET_ACCESS, { input });
  const asOwner = (): Promise<string> => actAsInNewSession(adminClient, businesses.a.owner, storeOne);
  const cancelOn = (store: StoreFixture): Promise<unknown> => {
    adminClient.setChannelToken(store.channelToken);
    return adminClient.query(CANCEL_ORDER);
  };
  const orderManagerOn = (id: string, stores: readonly StoreFixture[]): Promise<AccessAnswer> =>
    set({
      administratorId: id,
      roleIds: [orderManagerRole],
      storeAccess: 'selected',
      storeIds: stores.map((s) => s.id),
    });
  const orderManagerEverywhere = (id: string): Promise<AccessAnswer> =>
    set({ administratorId: id, roleIds: [orderManagerRole], storeAccess: 'all' });
  const openStore = async (): Promise<StoreFixture> => {
    const label = `opened-${randomBytes(3).toString('hex')}`;
    const answer = await adminClient.query<{ createStore: StoreFixture }>(CREATE_STORE, {
      input: { name: label, subdomain: label, language: 'ar' },
    });
    return answer.createStore;
  };

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    rows = new AccessRows(server.app);
    orderManagerRole = await rows.roleId(businesses.a.businessId, 'order-manager');
    [storeOne, storeTwo] = businesses.a.stores;
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  describe('the guard follows the assignment', () => {
    it('lets a selected member act on its store and refuses it on the other', async () => {
      // Arrange
      const target = await member();
      await asOwner();
      await orderManagerOn(target.id, [storeOne]);
      await actAsInNewSession(adminClient, target.credentials, storeOne);

      // Act
      const allowed = await cancelOn(storeOne);
      const refused = await failureOf(cancelOn(storeTwo));

      // Assert
      expect(allowed).toEqual({ rbacTestCancelOrder: true });
      expect(refused.codes).toEqual(['FORBIDDEN']);
    });

    it('lets an all-stores member act on both', async () => {
      // Arrange
      const target = await member();
      await asOwner();
      await orderManagerEverywhere(target.id);
      await actAsInNewSession(adminClient, target.credentials, storeOne);

      // Act
      const onOne = await cancelOn(storeOne);
      const onTwo = await cancelOn(storeTwo);

      // Assert
      expect(onOne).toEqual({ rbacTestCancelOrder: true });
      expect(onTwo).toEqual({ rbacTestCancelOrder: true });
    });
  });

  describe('Review Focus 2: a store opened later', () => {
    it('reaches an all-stores member on the next request after the flush, and not a selected one', async () => {
      // Arrange
      const everywhere = await member();
      const selected = await member();
      await asOwner();
      await orderManagerEverywhere(everywhere.id);
      await orderManagerOn(selected.id, [storeOne]);
      const selectedToken = await actAsInNewSession(adminClient, selected.credentials, storeOne);
      const everywhereToken = await actAsInNewSession(adminClient, everywhere.credentials, storeOne);
      await asOwner();

      // Act
      const opened = await openStore();

      // Assert
      adminClient.setAuthToken(everywhereToken);
      await vi.waitFor(() => expect(cancelOn(opened)).resolves.toEqual({ rbacTestCancelOrder: true }), {
        timeout: 5_000,
        interval: 100,
      });
      adminClient.setAuthToken(selectedToken);
      expect((await failureOf(cancelOn(opened))).codes).toEqual(['FORBIDDEN']);
    });
  });

  describe('Review Focus 5: an archived store', () => {
    let target: { credentials: CredentialsFixture; id: string };
    let archived: StoreFixture;

    beforeAll(async () => {
      target = await member();
      await asOwner();
      archived = await openStore();
      await orderManagerOn(target.id, [storeOne, archived]);
      await adminClient.query(ARCHIVE_STORE, { id: archived.id });
    });

    it('refuses the member there', async () => {
      // Arrange
      await actAsInNewSession(adminClient, target.credentials, storeOne);

      // Act
      const failure = await failureOf(cancelOn(archived));

      // Assert
      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('does not satisfy selected access', async () => {
      // Arrange
      const other = await member();
      await asOwner();

      // Act
      const failure = await failureOf(orderManagerOn(other.id, [archived]));

      // Assert
      expect(failure.codes).toEqual(['rbac.store-not-accessible']);
    });

    it('shows its activity rows to an all-stores member and not to a selected one', async () => {
      // Arrange
      const viewer = await member(['Authenticated', VIEW_LOG]);
      const service = server.app.get(ActivityLogService);
      const ctx = asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
      const storeId: StoreId = toStoreId(archived.id);
      await service.record(ctx, {
        scope: { businessId: toBusinessId(businesses.a.businessId) },
        storeId,
        actorAdministratorId: null,
        action: 'seed.row',
        entityType: 'archived-visibility',
        entityId: 'row',
        summary: 'Seeded',
        diff: {},
        ip: null,
        userAgent: null,
      });
      const listed = async (): Promise<number> =>
        (await adminClient.query<Page>(ACTIVITY_LOG_QUERY, { input: { entityType: 'archived-visibility' } }))
          .activityLog.items.length;

      // Act
      await asOwner();
      const asOwnerCount = await listed();
      await actAsInNewSession(adminClient, viewer.credentials, storeOne);
      const asMemberCount = await listed();

      // Assert
      expect(asOwnerCount).toBe(1);
      expect(asMemberCount).toBe(0);
    });
  });

  describe('the actor directory', () => {
    it('does not name an administrator of another business', async () => {
      // Arrange
      const service = server.app.get(ActivityLogService);
      const ctx = asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
      const ofB = Number(await rows.administratorId(businesses.b.owner));
      const ownerOfA = Number(await rows.administratorId(businesses.a.owner));
      const seed = (entityId: string, actorAdministratorId: number): Promise<void> =>
        service.record(ctx, {
          scope: { businessId: toBusinessId(businesses.a.businessId) },
          actorAdministratorId,
          action: 'seed.row',
          entityType: 'directory-scope',
          entityId,
          summary: 'Seeded',
          diff: {},
          ip: null,
          userAgent: null,
        });
      await seed('foreign', ofB);
      await seed('own', ownerOfA);
      await asOwner();

      // Act
      const page = await adminClient.query<Page>(ACTIVITY_LOG_QUERY, { input: { entityType: 'directory-scope' } });
      const nameOf = (entityId: string): string | undefined =>
        page.activityLog.items.find((item) => item.entityId === entityId)?.actor?.name;

      // Assert
      expect(nameOf('foreign')).toBe('');
      expect(nameOf('own')).not.toBe('');
    });
  });
});
