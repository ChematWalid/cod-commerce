import { randomBytes } from 'node:crypto';
import {
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_INITIAL_DATA,
  type StoreFixture,
  type TwoBusinesses,
} from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CREATE_STORE } from './built-in-roles-kit';
import { type AccessAnswer, ARCHIVE_STORE, SET_ACCESS } from './member-access-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';
import { allStoresRole, RoleApi, type RoleAnswer, RoleTeam } from './roles-kit';

const SNOWFLAKE_WORKER_ID = 1003;
const SUFFIX_BYTES = 3;
const TEAM_FULL = { team: 'full', orders: 'view' } as const;

describe('a role bound only to an archived store (D210, RBAC-4)', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  const api = new RoleApi(adminClient);
  let businesses: TwoBusinesses;
  let team: RoleTeam;
  let adminRole: RoleAnswer;
  let counter = 0;
  const unique = (label: string): string => {
    counter += 1;
    return `${label} ${String(counter)}`;
  };

  /** A third store of business A, so that archiving it never meets the last-store rule. */
  const openStore = async (): Promise<StoreFixture> => {
    await team.asOwner();
    const label = `reach-${randomBytes(SUFFIX_BYTES).toString('hex')}`;
    const answer = await adminClient.query<{ createStore: StoreFixture }>(CREATE_STORE, {
      input: { name: label, subdomain: label, language: 'ar' },
    });
    return answer.createStore;
  };

  const archive = async (store: StoreFixture): Promise<void> => {
    await team.asOwner();
    await adminClient.query(ARCHIVE_STORE, { id: store.id });
  };

  /** A role with the orders view keys, held by a member on `store` only, after which `store` is archived. */
  const heldOnArchivedStore = async (): Promise<{ role: RoleAnswer; holderId: string }> => {
    const spare = await openStore();
    const role = await api.create(allStoresRole(unique('Archived reach'), { orders: 'view' }));
    const holder = await team.member();
    await team.assign(holder.id, [role.id], [spare]);
    await archive(spare);
    return { role, holderId: holder.id };
  };

  const moveToHome = (holderId: string, roleId: string): Promise<AccessAnswer> =>
    adminClient.query<AccessAnswer>(SET_ACCESS, {
      input: { administratorId: holderId, roleIds: [roleId], storeAccess: 'selected', storeIds: [team.home.id] },
    });

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    team = new RoleTeam(server.app, adminClient, businesses, 'archived-reach');
    await team.asOwner();
    adminRole = await api.create(allStoresRole('Reach admin', TEAM_FULL));
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('keeps its holder out of reach of an actor limited to another store', async () => {
    // Arrange
    const { role, holderId } = await heldOnArchivedStore();
    await team.signedInMember([adminRole.id], [team.home]);

    // Act
    const failure = await failureOf(moveToHome(holderId, role.id));

    // Assert
    expect(failure.codes).toEqual(['rbac.privilege-exceeded']);
  });

  it('lets an all-stores owner change its holder (positive control)', async () => {
    // Arrange
    const { role, holderId } = await heldOnArchivedStore();
    await team.asOwner();

    // Act
    const { setMemberAccess } = await moveToHome(holderId, role.id);

    // Assert
    expect(setMemberAccess.storeIds).toEqual([team.home.id]);
  });

  it('cannot be edited or deleted by an actor limited to another store', async () => {
    // Arrange
    const { role } = await heldOnArchivedStore();
    await team.signedInMember([adminRole.id], [team.home]);

    // Act
    const edit = await failureOf(api.update(role.id, { name: unique('Nope') }));
    const removal = await failureOf(api.remove(role.id));

    // Assert
    expect(edit.codes).toEqual(['rbac.privilege-exceeded']);
    expect(removal.codes).toEqual(['rbac.privilege-exceeded']);
  });

  it('can be edited by an all-stores owner (positive control)', async () => {
    // Arrange
    const { role } = await heldOnArchivedStore();
    await team.asOwner();

    // Act
    const updated = await api.update(role.id, { name: unique('Renamed') });

    // Assert
    expect(updated.id).toBe(role.id);
  });
});
