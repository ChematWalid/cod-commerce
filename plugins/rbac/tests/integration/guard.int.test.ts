import {
  type CredentialsFixture,
  createMember,
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actAs, restStatus } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';

const SNOWFLAKE_WORKER_ID = 1008;
const FORBIDDEN_STATUS = 403;
const OK_STATUS = 200;

const CANCEL_ORDER = gql`
  mutation {
    rbacTestCancelOrder
  }
`;

const CLASS_CANCEL_ORDER = gql`
  mutation {
    rbacTestClassCancelOrder
  }
`;

const MY_CHANNELS = gql`
  query {
    me {
      channels {
        token
        permissions
      }
    }
  }
`;

interface MyChannels {
  readonly me: { readonly channels: readonly { readonly token: string; readonly permissions: readonly string[] }[] };
}

describe('requirePermission', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  let businesses: TwoBusinesses;
  let canceller: CredentialsFixture;
  let viewer: CredentialsFixture;
  let bystander: CredentialsFixture;

  const member = (code: string, permissions: readonly string[]): Promise<CredentialsFixture> =>
    createMember(server.app, adminClient, {
      code,
      business: businesses.a,
      store: businesses.a.stores[0],
      permissions,
    });

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    canceller = await member('guard-canceller', ['Authenticated', 'CodOrdersCancel']);
    viewer = await member('guard-viewer', ['Authenticated', 'CodOrdersView']);
    bystander = await member('guard-bystander', ['Authenticated']);
  });

  afterAll(async () => {
    await server.destroy();
  });

  describe('on a GraphQL mutation', () => {
    it('lets a holder of the permission through on the store its role is on', async () => {
      // Arrange
      await actAs(adminClient, canceller, businesses.a.stores[0]);

      // Act
      const answer = await adminClient.query<{ rbacTestCancelOrder: boolean }>(CANCEL_ORDER);

      // Assert
      expect(answer.rbacTestCancelOrder).toBe(true);
    });

    it('refuses a member of the business without the permission', async () => {
      // Arrange
      await actAs(adminClient, bystander, businesses.a.stores[0]);

      // Act
      const failure = await failureOf(adminClient.query(CANCEL_ORDER));

      // Assert
      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('refuses an anonymous caller', async () => {
      // Arrange
      await adminClient.asAnonymousUser();
      adminClient.setChannelToken(businesses.a.stores[0].channelToken);

      // Act
      const failure = await failureOf(adminClient.query(CANCEL_ORDER));

      // Assert
      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('refuses the same holder on a store of its business its role is not on', async () => {
      // Arrange
      await actAs(adminClient, canceller, businesses.a.stores[1]);

      // Act
      const failure = await failureOf(adminClient.query(CANCEL_ORDER));

      // Assert
      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it("refuses the same holder with another business's store token", async () => {
      // Arrange
      await actAs(adminClient, canceller, businesses.b.stores[0]);

      // Act
      const failure = await failureOf(adminClient.query(CANCEL_ORDER));

      // Assert
      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('fails closed for the platform superadmin, who holds the permission but has no tenant', async () => {
      // Arrange: the positive control shows the refusal comes from the tenant check, not from the permission
      const storeToken = businesses.a.stores[0].channelToken;
      adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
      await adminClient.asSuperAdmin();
      const { me } = await adminClient.query<MyChannels>(MY_CHANNELS);
      expect(me.channels.find((channel) => channel.token === storeToken)?.permissions).toContain('CodOrdersCancel');
      adminClient.setChannelToken(storeToken);

      // Act
      const failure = await failureOf(adminClient.query(CANCEL_ORDER));

      // Assert
      expect(failure.codes).toEqual(['FORBIDDEN']);
    });
  });

  describe('on a REST handler', () => {
    it('lets a holder of the permission through', async () => {
      // Arrange
      await actAs(adminClient, viewer, businesses.a.stores[0]);

      // Act
      const status = await restStatus(server.app, adminClient, '/rbac-test/orders-view');

      // Assert
      expect(status).toBe(OK_STATUS);
    });

    it('refuses a member without the permission', async () => {
      // Arrange
      await actAs(adminClient, bystander, businesses.a.stores[0]);

      // Act
      const status = await restStatus(server.app, adminClient, '/rbac-test/orders-view');

      // Assert
      expect(status).toBe(FORBIDDEN_STATUS);
    });
  });

  describe('on a class', () => {
    it('lets a holder of the class permission call a resolver with no decorator of its own', async () => {
      // Arrange
      await actAs(adminClient, canceller, businesses.a.stores[0]);

      // Act
      const answer = await adminClient.query<{ rbacTestClassCancelOrder: boolean }>(CLASS_CANCEL_ORDER);

      // Assert
      expect(answer.rbacTestClassCancelOrder).toBe(true);
    });

    it('refuses a member without the class permission on a resolver with no decorator of its own', async () => {
      // Arrange
      await actAs(adminClient, bystander, businesses.a.stores[0]);

      // Act
      const failure = await failureOf(adminClient.query(CLASS_CANCEL_ORDER));

      // Assert
      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('lets a holder of the class permission reach a handler with no decorator of its own', async () => {
      // Arrange
      await actAs(adminClient, viewer, businesses.a.stores[0]);

      // Act
      const status = await restStatus(server.app, adminClient, '/rbac-test/class-guarded');

      // Assert
      expect(status).toBe(OK_STATUS);
    });

    it('refuses a member without the class permission on a handler with no decorator of its own', async () => {
      // Arrange
      await actAs(adminClient, bystander, businesses.a.stores[0]);

      // Act
      const status = await restStatus(server.app, adminClient, '/rbac-test/class-guarded');

      // Assert
      expect(status).toBe(FORBIDDEN_STATUS);
    });

    it("keeps a handler's own permission over the class one", async () => {
      // Arrange
      await actAs(adminClient, viewer, businesses.a.stores[0]);

      // Act
      const status = await restStatus(server.app, adminClient, '/rbac-test/class-guarded/cancel');

      // Assert
      expect(status).toBe(FORBIDDEN_STATUS);
    });
  });
});
