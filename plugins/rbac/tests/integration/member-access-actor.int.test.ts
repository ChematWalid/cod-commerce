import {
  type CredentialsFixture,
  createMember,
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_INITIAL_DATA,
  type StoreFixture,
  type TwoBusinesses,
} from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type AccessAnswer, type AccessInput, AccessRows, SET_ACCESS } from './member-access-kit';
import { actAsInNewSession } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';

const SNOWFLAKE_WORKER_ID = 1019;

describe('a selected actor changing access', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  let businesses: TwoBusinesses;
  let rows: AccessRows;
  let orderManagerRole: string;
  let managerRole: string;
  let trackerRole: string;
  let storeOne: StoreFixture;
  let storeTwo: StoreFixture;
  let counter = 0;

  const member = async (): Promise<{ credentials: CredentialsFixture; id: string }> => {
    counter += 1;
    const credentials = await createMember(server.app, adminClient, {
      code: `actor-${String(counter)}`,
      business: businesses.a,
      store: storeOne,
      permissions: ['Authenticated'],
    });
    return { credentials, id: await rows.administratorId(credentials) };
  };

  const set = (input: AccessInput): Promise<AccessAnswer> => adminClient.query<AccessAnswer>(SET_ACCESS, { input });
  const asOwner = (): Promise<string> => actAsInNewSession(adminClient, businesses.a.owner, storeOne);
  const onStores = (roleId: string, id: string, stores: readonly StoreFixture[]): Promise<AccessAnswer> =>
    set({ administratorId: id, roleIds: [roleId], storeAccess: 'selected', storeIds: stores.map((s) => s.id) });
  const orderManagerOn = (id: string, stores: readonly StoreFixture[]): Promise<AccessAnswer> =>
    onStores(orderManagerRole, id, stores);
  const trackerOn = (id: string, stores: readonly StoreFixture[]): Promise<AccessAnswer> =>
    onStores(trackerRole, id, stores);

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    rows = new AccessRows(server.app);
    orderManagerRole = await rows.roleId(businesses.a.businessId, 'order-manager');
    managerRole = await rows.roleId(businesses.a.businessId, 'manager');
    trackerRole = await rows.roleId(businesses.a.businessId, 'order-tracker');
    [storeOne, storeTwo] = businesses.a.stores;
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  let actor: { credentials: CredentialsFixture; id: string };

  beforeAll(async () => {
    actor = await member();
    await asOwner();
    await set({
      administratorId: actor.id,
      roleIds: [managerRole],
      storeAccess: 'selected',
      storeIds: [storeOne.id],
    });
  });

  it('can change a member within its store', async () => {
    // Arrange
    const target = await member();
    await actAsInNewSession(adminClient, actor.credentials, storeOne);

    // Act
    const { setMemberAccess } = await trackerOn(target.id, [storeOne]);

    // Assert
    expect(setMemberAccess.storeIds).toEqual([storeOne.id]);
  });

  it('cannot grant a role holding more than it holds', async () => {
    // Arrange
    const target = await member();
    await actAsInNewSession(adminClient, actor.credentials, storeOne);

    // Act
    const failure = await failureOf(orderManagerOn(target.id, [storeOne]));

    // Assert
    expect(failure.codes).toEqual(['rbac.privilege-exceeded']);
  });

  it('cannot grant all stores', async () => {
    // Arrange
    const target = await member();
    await actAsInNewSession(adminClient, actor.credentials, storeOne);

    // Act
    const failure = await failureOf(set({ administratorId: target.id, roleIds: [trackerRole], storeAccess: 'all' }));

    // Assert
    expect(failure.codes).toEqual(['rbac.store-not-accessible']);
  });

  it('cannot grant a store it lacks', async () => {
    // Arrange
    const target = await member();
    await actAsInNewSession(adminClient, actor.credentials, storeOne);

    // Act
    const failure = await failureOf(trackerOn(target.id, [storeOne, storeTwo]));

    // Assert
    expect(failure.codes).toEqual(['rbac.store-not-accessible']);
  });

  it('cannot change a member who is also on a store it lacks', async () => {
    // Arrange
    const target = await member();
    await asOwner();
    await trackerOn(target.id, [storeOne, storeTwo]);
    await actAsInNewSession(adminClient, actor.credentials, storeOne);

    // Act
    const failure = await failureOf(trackerOn(target.id, [storeOne]));

    // Assert
    expect(failure.codes).toEqual(['rbac.privilege-exceeded']);
  });

  it('can change a two-store member once it holds both stores', async () => {
    // Arrange
    const wide = await member();
    const target = await member();
    await asOwner();
    await set({
      administratorId: wide.id,
      roleIds: [managerRole],
      storeAccess: 'selected',
      storeIds: [storeOne.id, storeTwo.id],
    });
    await trackerOn(target.id, [storeOne, storeTwo]);
    await actAsInNewSession(adminClient, wide.credentials, storeOne);

    // Act
    const { setMemberAccess } = await trackerOn(target.id, [storeTwo]);

    // Assert
    expect(setMemberAccess.storeIds).toEqual([storeTwo.id]);
  });
});
