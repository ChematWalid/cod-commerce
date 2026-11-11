import { randomBytes } from 'node:crypto';
import type { BuiltInRoleKey, PermissionKey } from '@cod/shared';
import {
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_INITIAL_DATA,
  type StoreFixture,
  type TwoBusinesses,
} from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CREATE_STORE } from './built-in-roles-kit';
import { ARCHIVE_STORE } from './member-access-kit';
import { actAsInNewSession } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';
import { RoleApi, RoleTeam } from './roles-kit';

const SNOWFLAKE_WORKER_ID = 1012;
const SUFFIX_BYTES = 3;
const ARCHIVE_KEY: PermissionKey = 'store.stores.archive';
const OPEN_AND_SEE_KEYS: readonly PermissionKey[] = ['store.stores.create', 'store.stores.view'];

const STORE_STATUS = gql`
  query ($id: String!) {
    store(id: $id) {
      status
    }
  }
`;

interface ArchiveAnswer {
  readonly archiveStore: { readonly id: string; readonly status: string };
}

describe('archiveStore for a member', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  const api = new RoleApi(adminClient);
  let businesses: TwoBusinesses;
  let team: RoleTeam;
  let archivistRole: string;
  let openerRole: string;

  /** A third store of business A, opened by its owner, so that archiving it never meets the last-store rule. */
  const openStore = async (): Promise<StoreFixture> => {
    await team.asOwner();
    const label = `spare-${randomBytes(SUFFIX_BYTES).toString('hex')}`;
    const answer = await adminClient.query<{ createStore: StoreFixture }>(CREATE_STORE, {
      input: { name: label, subdomain: label, language: 'ar' },
    });
    return answer.createStore;
  };

  const archive = (id: string): Promise<ArchiveAnswer> => adminClient.query<ArchiveAnswer>(ARCHIVE_STORE, { id });

  const statusAsOwnerOfB = async (id: string): Promise<string | undefined> => {
    await actAsInNewSession(adminClient, businesses.b.owner, businesses.b.stores[0]);
    const answer = await adminClient.query<{ store: { status: string } | null }>(STORE_STATUS, { id });
    return answer.store?.status;
  };

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    team = new RoleTeam(server.app, adminClient, businesses, 'archive');
    await team.asOwner();
    archivistRole = (await api.create({ name: 'Archivist', grants: [ARCHIVE_KEY, 'store.stores.view'] })).id;
    openerRole = (await api.create({ name: 'Opener', grants: OPEN_AND_SEE_KEYS })).id;
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('archives a store of their business when their role holds store.stores.archive', async () => {
    // Arrange
    const spare = await openStore();
    await team.signedInMember([archivistRole], undefined);

    // Act
    const { archiveStore } = await archive(spare.id);

    // Assert
    expect(archiveStore).toEqual({ id: spare.id, status: 'archived' });
  });

  it('is FORBIDDEN when their role opens and sees stores but does not hold store.stores.archive', async () => {
    // Arrange
    const spare = await openStore();
    await team.signedInMember([openerRole], undefined);

    // Act
    const failure = await failureOf(archive(spare.id));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  it.each<BuiltInRoleKey>(['manager', 'store-manager'])('is FORBIDDEN for the built-in %s role', async (key) => {
    // Arrange
    const spare = await openStore();
    const builtIn = await team.rows.roleId(businesses.a.businessId, key);
    await team.signedInMember([builtIn], undefined);

    // Act
    const failure = await failureOf(archive(spare.id));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  it('never archives a store of another business, which stays active', async () => {
    // Arrange
    const storeOfB = businesses.b.stores[1];
    await team.signedInMember([archivistRole], undefined);

    // Act
    const failure = await failureOf(archive(storeOfB.id));
    const status = await statusAsOwnerOfB(storeOfB.id);

    // Assert
    expect(failure.codes).toEqual(['tenancy.store-not-found']);
    expect(status).toBe('active');
  });
});
