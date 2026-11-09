import { PLATFORM_STAFF_PERMISSION } from '@cod/shared';
import { PermissionDefinition } from '@vendure/core';
import { gql } from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import { ownerRolePermissions } from '../../infrastructure/owner-role-permissions';
import {
  ACTIVE_BUSINESS,
  ARCHIVE_STORE,
  BUSINESS,
  CHANGE_STORE_SUBDOMAIN,
  CREATE_STORE,
  STORE,
  STORES,
  type StoreView,
  UPDATE_BUSINESS,
  UPDATE_STORE,
} from './admin-api-operations';
import { actAsMember, createMember } from './admin-api-session';
import { failureOf, PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from '@cod/testing';
import { type StoreApi, useStoreApi } from './store-api-harness';

const MY_PERMISSIONS = gql`
  query {
    me {
      channels {
        token
        permissions
      }
    }
  }
`;

interface MyPermissions {
  readonly me: { readonly channels: readonly { readonly token: string; readonly permissions: readonly string[] }[] };
}

type Variables = (api: StoreApi) => Record<string, unknown>;

const AUTHENTICATED_ONLY = 'alpha-authenticated';
const STORE_READER = 'alpha-store-reader';

const HANDLERS: readonly [string, typeof STORES, Variables][] = [
  ['activeBusiness', ACTIVE_BUSINESS, () => ({})],
  ['business', BUSINESS, (api) => ({ id: api.alpha.business.id })],
  ['updateBusiness', UPDATE_BUSINESS, () => ({ input: { name: 'x y' } })],
  ['stores', STORES, () => ({})],
  ['store', STORE, (api) => ({ id: api.alpha.store.id })],
  ['createStore', CREATE_STORE, () => ({ input: { name: 'x y', subdomain: 'no-permission', language: 'ar' } })],
  ['updateStore', UPDATE_STORE, (api) => ({ id: api.alpha.store.id, input: { name: 'x y' } })],
  ['archiveStore', ARCHIVE_STORE, (api) => ({ id: api.alpha.store.id })],
  ['changeStoreSubdomain', CHANGE_STORE_SUBDOMAIN, (api) => ({ id: api.alpha.store.id, subdomain: 'no-permission' })],
];

describe('Admin API permissions of a tenant member', () => {
  const api = useStoreApi(1005);
  const { server, adminClient } = api;

  beforeAll(async () => {
    const member = { businessId: api.alpha.business.id, channelId: api.alpha.store.channelId };
    await createMember(server.app, adminClient, {
      ...member,
      code: AUTHENTICATED_ONLY,
      permissions: ['Authenticated'],
    });
    await createMember(server.app, adminClient, {
      ...member,
      code: STORE_READER,
      permissions: ['Authenticated', 'ReadTenantStore'],
    });
  });

  it('passes the tenant guard for a member of the business, so a refusal below is the permission check', async () => {
    // Arrange
    await actAsMember(server.app, adminClient, STORE_READER, api.alpha.store.channelId);

    // Act
    const { stores } = await adminClient.query<{ stores: StoreView[] }>(STORES);

    // Assert
    expect(stores.map((store) => store.id)).toEqual([api.alpha.store.id]);
  });

  it.each(HANDLERS)('forbids %s for a member lacking its permission', async (_name, operation, variables) => {
    // Arrange
    await actAsMember(server.app, adminClient, AUTHENTICATED_ONLY, api.alpha.store.channelId);

    // Act
    const failure = await failureOf(adminClient.query(operation, variables(api)));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  describe('the PlatformStaff permission (D78)', () => {
    const channelsHolding = async (): Promise<string[]> => {
      const { me } = await adminClient.query<MyPermissions>(MY_PERMISSIONS);
      return me.channels
        .filter((channel) => channel.permissions.includes(PLATFORM_STAFF_PERMISSION))
        .map((c) => c.token);
    };

    it('is held by the superadmin on the default channel and on a store channel', async () => {
      // Arrange
      const storeChannel = await api.channels().findOneByOrFail({ id: api.alpha.store.channelId });

      // Act
      const holding = await channelsHolding();

      // Assert
      expect(holding).toContain(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
      expect(holding).toContain(storeChannel.token);
    });

    it("is held on none of a freshly provisioned owner's channels", async () => {
      // Arrange
      await api.asAlpha();

      // Act
      const holding = await channelsHolding();

      // Assert
      expect(holding).toEqual([]);
    });

    it('is left out of what an Owner role receives', () => {
      // Arrange
      const definition = new PermissionDefinition({ name: PLATFORM_STAFF_PERMISSION, assignable: true });

      // Act
      const permissions = ownerRolePermissions([definition]);

      // Assert
      expect(permissions).toEqual([]);
    });
  });
});
