import { PERMISSION_CATALOG } from '@cod/shared';
import { createMember, createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACTIVITY_LOG_QUERY, type Page } from './activity-kit';
import { OPERATION_REGISTRY, ROUTE_REGISTRY } from './endpoint-registry';
import { MEMBER_ACCESS, SET_ACCESS } from './member-access-kit';
import { actAs, actAsInNewSession, restCall } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';
import { allStoresRole, RoleApi, type RoleAnswer, RoleTeam } from './roles-kit';
import {
  BusinessRows,
  graphqlOutcome,
  graphqlSurface,
  type Outcome,
  restSurface,
  roleOf,
  type RoleSurface,
  rolesOf,
} from './two-business-kit';

const SNOWFLAKE_WORKER_ID = 1013;
const NOT_FOUND = 'rbac.role-not-found';
const MEMBER_NOT_FOUND = 'rbac.member-not-found';
const NOT_FOUND_STATUS = 404;
const FORBIDDEN_STATUS = 403;
const OK_STATUS = 200;
const TEAM_VIEW = [{ area: 'team', level: 'view' }];

interface Actor {
  readonly label: string;
  readonly signIn: () => Promise<unknown>;
  /** What the actor holds on its store, which `effectivePermissions` must answer. */
  readonly held: () => readonly string[];
}

describe('two businesses: roles, permissions, member access and the activity log', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  const api = new RoleApi(adminClient);
  const rows = new BusinessRows(server);
  const surfaces: RoleSurface[] = [graphqlSurface(adminClient), restSurface(server, adminClient)];
  let businesses: TwoBusinesses;
  let team: RoleTeam;
  let staff: RoleAnswer;
  let staffMember: Awaited<ReturnType<RoleTeam['member']>>;
  let target: Awaited<ReturnType<RoleTeam['member']>>;
  let lowRole: RoleAnswer;
  let foreign: { role: RoleAnswer; ownerRoleId: string; memberId: string; ownerId: string };
  let counter = 0;
  const unique = (label: string): string => {
    counter += 1;
    return `${label} ${String(counter)}`;
  };

  const actors: Actor[] = [
    { label: 'the owner of A', signIn: () => team.asOwner(), held: () => PERMISSION_CATALOG.map(({ key }) => key) },
    {
      label: 'a member of A',
      signIn: () => actAsInNewSession(adminClient, staffMember.credentials, team.home),
      held: () => staff.permissions,
    },
  ];

  const foreignSnapshot = (): ReturnType<BusinessRows['snapshot']> => rows.snapshot(businesses.b.businessId);

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    team = new RoleTeam(server.app, adminClient, businesses, 'iso');
    await team.asOwner();
    staff = await api.create(allStoresRole('Isolation staff', { team: 'full', settings: 'full' }));
    lowRole = await api.create(allStoresRole('Isolation low', { team: 'view' }));
    staffMember = await team.member();
    target = await team.member();
    await team.assign(staffMember.id, [staff.id]);
    await actAs(adminClient, businesses.b.owner, businesses.b.stores[0]);
    const role = await api.create(allStoresRole('Isolation private', { orders: 'full' }));
    const credentials = await createMember(server.app, adminClient, {
      code: 'iso-b-member',
      business: businesses.b,
      store: businesses.b.stores[0],
      permissions: ['Authenticated'],
    });
    foreign = {
      role,
      ownerRoleId: await team.rows.roleId(businesses.b.businessId, 'owner'),
      memberId: await team.rows.administratorId(credentials),
      ownerId: await team.rows.administratorId(businesses.b.owner),
    };
  }, 180_000);

  afterAll(async () => {
    await server.destroy();
  });

  describe.each(actors)('as $label', (actor) => {
    describe.each(surfaces)('over $name', (surface) => {
      it('lists the roles of its own business only, and creates one of its own', async () => {
        // Arrange
        await actor.signIn();
        const before = await foreignSnapshot();

        // Act
        const listed = rolesOf(await surface.list());
        const ownIds = await rows.roleIds(businesses.a.businessId);
        const created = await surface.create({ name: unique('Own'), areaLevels: TEAM_VIEW });

        // Assert
        const foreignIds = await rows.roleIds(businesses.b.businessId);
        expect(listed.map(({ id }) => id).sort()).toEqual(ownIds.sort());
        expect(listed.some(({ id }) => foreignIds.includes(id))).toBe(false);
        expect(listed.find(({ builtInKey }) => builtInKey === 'owner')?.id).not.toBe(foreign.ownerRoleId);
        expect(created.code).toBeUndefined();
        expect(rolesOf(await surface.list()).some(({ id }) => id === roleOf(created).id)).toBe(true);
        expect(await foreignSnapshot()).toEqual(before);
      });

      it("treats every operation on another business's role as not found, and leaves it as it was", async () => {
        // Arrange
        await actor.signIn();
        const own = roleOf(await surface.create({ name: unique('Control'), areaLevels: TEAM_VIEW }));

        // Act: positive control on its own role
        const renamed = await surface.update(own.id, { name: unique('Renamed') });
        const copy = await surface.duplicate(own.id);
        const removed = [await surface.remove(roleOf(copy).id), await surface.remove(own.id)];

        // Assert: the control changed A's side
        expect([renamed.code, copy.code, ...removed.map(({ code }) => code)]).toEqual(new Array(4).fill(undefined));
        expect(roleOf(renamed).name).not.toBe(own.name);
        expect(await rows.roleNamed(businesses.a.businessId, own.id)).toBeUndefined();

        // Act: the same operations on B's roles
        const before = await foreignSnapshot();
        const outcomes = await Promise.all(
          [foreign.role.id, foreign.ownerRoleId].flatMap((id) => [
            surface.get(id),
            surface.update(id, { name: unique('Took') }),
            surface.remove(id),
            surface.duplicate(id),
            surface.create({ name: unique('From'), startFromRoleId: id }),
          ]),
        );

        // Assert
        const refused = outcomes.filter(
          ({ code, data }) => code === NOT_FOUND || (code === undefined && data === null),
        );
        expect(refused).toHaveLength(outcomes.length);
        if (surface.name === 'rest')
          expect(outcomes.map(({ status }) => status)).toEqual(new Array(10).fill(NOT_FOUND_STATUS));
        expect(await foreignSnapshot()).toEqual(before);
        await actAs(adminClient, businesses.b.owner, businesses.b.stores[0]);
        expect(await api.get(foreign.role.id)).toMatchObject({
          name: foreign.role.name,
          permissions: foreign.role.permissions,
        });
      });

      it('answers the catalog and what the actor holds on its own store', async () => {
        // Arrange
        await actor.signIn();

        // Act
        const catalog = await surface.catalog();
        const effective = await surface.effective();

        // Assert
        expect((catalog.data as { permissions: unknown[] }).permissions).toHaveLength(PERMISSION_CATALOG.length);
        const held = effective.data as { storeId: string; permissions: string[]; storeAccess: string };
        expect(held.storeId).toBe(team.home.id);
        expect([...held.permissions].sort()).toEqual([...actor.held()].sort());
      });
    });

    describe('over GraphQL, member access and the activity log', () => {
      it("reads A's member and never B's", async () => {
        // Arrange
        await actor.signIn();

        // Act
        const read = (administratorId: string): Promise<{ memberAccess: { administratorId: string } | null }> =>
          adminClient.query(MEMBER_ACCESS, { administratorId });
        const own = await read(target.id);
        const foreignReads = [await read(foreign.memberId), await read(foreign.ownerId)];

        // Assert
        expect(own.memberAccess?.administratorId).toBe(target.id);
        expect(foreignReads.map(({ memberAccess }) => memberAccess)).toEqual([null, null]);
      });

      it('refuses the role, the administrator and the store of B, and leaves both businesses as they were', async () => {
        // Arrange
        await actor.signIn();
        const set = (input: Record<string, unknown>): Promise<Outcome> =>
          graphqlOutcome(adminClient.query(SET_ACCESS, { input }));
        const control = await set({
          administratorId: target.id,
          roleIds: [lowRole.id],
          storeAccess: 'selected',
          storeIds: [team.home.id],
        });
        const before = await foreignSnapshot();
        const assigned = await rows.assignedRoleIds(businesses.a.businessId, target.id);

        // Act
        const refusals = [
          await set({ administratorId: target.id, roleIds: [foreign.role.id], storeAccess: 'all' }),
          await set({ administratorId: foreign.memberId, roleIds: [lowRole.id], storeAccess: 'all' }),
          await set({ administratorId: foreign.ownerId, roleIds: [lowRole.id], storeAccess: 'all' }),
          await set({
            administratorId: target.id,
            roleIds: [lowRole.id],
            storeAccess: 'selected',
            storeIds: [businesses.b.stores[0].id],
          }),
        ];

        // Assert
        expect(control.code).toBeUndefined();
        expect(assigned).toEqual([lowRole.id]);
        expect(refusals.map(({ code }) => code)).toEqual([
          NOT_FOUND,
          MEMBER_NOT_FOUND,
          MEMBER_NOT_FOUND,
          'rbac.store-not-accessible',
        ]);
        expect(await foreignSnapshot()).toEqual(before);
        expect(await rows.assignedRoleIds(businesses.a.businessId, target.id)).toEqual(assigned);
      });

      it("keeps B's actions out of A's activity log", async () => {
        // Arrange
        await actAs(adminClient, businesses.b.owner, businesses.b.stores[0]);
        await api.update(foreign.role.id, { description: unique('B edit') });
        await actor.signIn();
        const own = await api.create({ name: unique('Logged'), areaLevels: TEAM_VIEW });

        // Act
        const page = await adminClient.query<Page>(ACTIVITY_LOG_QUERY, { input: { first: 100 } });

        // Assert
        const foreignEntities = await rows.activityEntityIds(businesses.b.businessId);
        const listed = page.activityLog.items.map(({ entityId }) => entityId);
        expect(foreignEntities.length).toBeGreaterThan(0);
        expect(listed).toContain(own.id);
        expect(listed.filter((entityId) => foreignEntities.includes(entityId))).toEqual([]);
      });
    });
  });

  describe('REST without a permission', () => {
    it('refuses a member with no role on every route that needs one, and serves the open ones', async () => {
      // Arrange
      const bystander = await team.member();
      await actAsInNewSession(adminClient, bystander.credentials, team.home);

      // Act
      const answers = await Promise.all(
        ROUTE_REGISTRY.map(async (entry) => ({
          entry,
          answer: await restCall(server.app, adminClient, { method: entry.method, path: entry.url, body: entry.body }),
        })),
      );

      // Assert
      const statuses = answers.map(({ entry, answer }) => [entry.access, answer.status]);
      expect(statuses).toEqual(
        ROUTE_REGISTRY.map(({ access }) => [access, access === 'authenticated' ? OK_STATUS : FORBIDDEN_STATUS]),
      );
    });
  });

  describe('anonymous callers', () => {
    it.each(OPERATION_REGISTRY)('refuses $operation with FORBIDDEN', async ({ document, variables }) => {
      // Arrange
      await adminClient.asAnonymousUser();
      adminClient.setChannelToken(businesses.a.stores[0].channelToken);

      // Act
      const outcome = await graphqlOutcome(adminClient.query(gql(document), variables));

      // Assert
      expect(outcome.code).toBe('FORBIDDEN');
    });

    it.each(ROUTE_REGISTRY)('refuses $method $route with 403', async ({ method, url, body }) => {
      // Arrange
      await adminClient.asAnonymousUser();
      adminClient.setChannelToken(businesses.a.stores[0].channelToken);

      // Act
      const answer = await restCall(server.app, adminClient, { method, path: url, body });

      // Assert
      expect(answer.status).toBe(FORBIDDEN_STATUS);
    });
  });
});
