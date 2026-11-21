import { AuthPlugin } from '@cod/plugin-auth';
import { randomBytes } from 'node:crypto';
import { CatalogPlugin } from '@cod/plugin-catalog';
import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import {
  ACTIVITY_LOG_SCHEMA,
  asOperationContext as asRbacContext,
  CreateRoleService,
  MemberAccessService,
  RbacPlugin,
} from '@cod/plugin-rbac';
import { asOperationContext as asTenancyContext, ProvisionBusinessService, TenancyPlugin } from '@cod/plugin-tenancy';
import { type StoreId, toBusinessId, toStoreId } from '@cod/shared';
import {
  type BusinessFixture,
  createMember,
  createPluginTestEnvironment,
  createTwoBusinesses,
  loadPluginTestDbConfig,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
  withPartitionedSchemas,
} from '@cod/testing';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import { TeamConvergeService, TeamPlugin } from '../../index';
import { TeamMemberEntity } from '../../infrastructure/team-member.entity';
import { authTestOptions, OUTBOX_SCHEMAS, teamOutboxPlugins } from './team-kit';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';
const SNOWFLAKE_WORKER_ID = 1008;
const NO_ORIGIN = { ip: null, userAgent: null };
/** Synthetic; the owner of the business provisioned with the hooks reversed signs in with it. */
const OWNER_PASSWORD = 'synthetic-owner-password';

const { server, adminClient } = createPluginTestEnvironment({
  plugins: [
    PlatformPartitionsPlugin,
    RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
    TenancyPlugin.init({
      redisUrl: TEST_REDIS_URL,
      platformDomain: 'localhost',
      snowflakeWorkerId: SNOWFLAKE_WORKER_ID,
    }),
    // Team writes `salary.paid` to the outbox (D222), whose tables are partitioned.
    ...teamOutboxPlugins(),
    RbacPlugin,
    // Team's invitations need auth's invited accounts and mail queue.
    AuthPlugin.init(authTestOptions()),
    // Team imports the catalog's module to register its order-manager check (D2137).
    CatalogPlugin,
    TeamPlugin.init({ dashboardUrl: 'http://localhost:3100/dashboard' }),
  ],
  db: loadPluginTestDbConfig(process.env),
});
// Granting a role writes the partitioned `activity_log`, which `synchronize` cannot make (D130); so is the outbox.
withPartitionedSchemas(server, [...OUTBOX_SCHEMAS, ACTIVITY_LOG_SCHEMA], PartitionMaintenanceService);

let businesses: TwoBusinesses;

const connection = () => server.app.get(TransactionalConnection).rawConnection;
const context = async (): Promise<OperationContext> =>
  asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));

/** Test-only direct reads (the test files are outside the data access gate). */
const membersOf = (businessId: string): Promise<TeamMemberEntity[]> =>
  connection()
    .getRepository(TeamMemberEntity)
    .find({ where: { businessId }, order: { administratorId: 'ASC' } });

async function administratorIdOf(email: string): Promise<number> {
  const rows = await connection().query<{ id: number }[]>('SELECT id FROM administrator WHERE "emailAddress" = $1', [
    email,
  ]);
  const [row] = rows;
  if (row === undefined) throw new Error(`no administrator ${email}`);
  return row.id;
}

async function builtInRoleId(business: BusinessFixture, key: string): Promise<string> {
  const rows = await connection().query<{ id: string }[]>(
    'SELECT id FROM business_role WHERE "businessId" = $1 AND "builtInKey" = $2',
    [business.businessId, key],
  );
  const [row] = rows;
  if (row === undefined) throw new Error(`no ${key} role in ${business.businessId}`);
  return row.id;
}

const ownerActor = async (business: BusinessFixture) => ({
  administratorId: await administratorIdOf(business.owner.email),
  scope: { businessId: toBusinessId(business.businessId) },
  ...NO_ORIGIN,
});

/** A member of the business holding `roleId` on every store, granted by the owner through rbac (D215). */
async function grantedMember(business: BusinessFixture, code: string, roleId: string): Promise<number> {
  const credentials = await createMember(server.app, adminClient, {
    code,
    business,
    store: business.stores[0],
    permissions: [],
  });
  const administratorId = await administratorIdOf(credentials.email);
  const ctx = asRbacContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
  await server.app.get(MemberAccessService).setAccess(ctx, {
    actor: await ownerActor(business),
    administratorId,
    roleIds: [roleId],
    storeAccess: 'all',
    storeIds: [],
  });
  return administratorId;
}

/** A custom role made the way the demo seed makes its members' roles. */
async function demoSeedRole(business: BusinessFixture): Promise<string> {
  const storeIds: readonly StoreId[] = business.stores.map((store) => toStoreId(store.id));
  const [activeStoreId] = storeIds;
  if (activeStoreId === undefined) throw new Error('the business has no store');
  const { administratorId } = await ownerActor(business);
  const actor = {
    administratorId,
    tenant: { businessId: toBusinessId(business.businessId), storeIds, activeStoreId },
    ...NO_ORIGIN,
  };
  const ctx = asRbacContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
  const role = await server.app.get(CreateRoleService).create(ctx, actor, {
    name: `Demo viewer ${randomBytes(3).toString('hex')}`,
    description: null,
    startFromRoleId: null,
    areaLevels: [],
    grants: ['team.roles.view'],
    revokes: [],
  });
  return role.id;
}

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  businesses = await createTwoBusinesses(adminClient);
});

afterAll(async () => {
  await server.destroy();
});

describe('every business administrator is a team member (D215)', () => {
  it('provisioning a business makes its owner one active member with no salary', async () => {
    // Arrange
    const ownerId = await administratorIdOf(businesses.a.owner.email);

    // Act
    const members = await membersOf(businesses.a.businessId);

    // Assert
    expect(members).toEqual([
      expect.objectContaining({
        administratorId: ownerId,
        email: businesses.a.owner.email,
        emailKey: businesses.a.owner.email,
        firstName: 'a',
        lastName: 'Owner',
        status: 'active',
        baseSalary: 0,
        removedAt: null,
        suspendedAccess: null,
      }),
    ]);
    expect(members[0]?.joinedAt).toBeInstanceOf(Date);
  });

  it("adds the owner even when Team's hook runs before rbac's", async () => {
    // Arrange
    // Test-only reach into tenancy's registry (its token is internal): the hooks run in this array's order.
    const provisioning = server.app.get(ProvisionBusinessService);
    const registry = (provisioning as unknown as { ports: { lifecycle: { hooks: unknown[] } } }).ports.lifecycle;
    expect(registry.hooks.map((hook) => (hook as object).constructor.name)).toEqual([
      'RbacLifecycleHook',
      'TeamLifecycleHook',
    ]);
    const suffix = randomBytes(3).toString('hex');
    const email = `c-owner-${suffix}@example.test`;
    registry.hooks.reverse();

    // Act
    let businessId: string;
    try {
      const ctx = asTenancyContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
      const provisioned = await provisioning.provision(ctx, {
        name: 'C SARL',
        owner: { emailAddress: email, firstName: 'c', lastName: 'Owner', password: OWNER_PASSWORD },
        store: { name: 'C store', subdomain: `c1-${suffix}`, language: 'ar' },
      });
      businessId = provisioned.business.id;
    } finally {
      registry.hooks.reverse();
    }

    // Assert
    const ownerId = await administratorIdOf(email);
    expect(await membersOf(businessId)).toEqual([
      expect.objectContaining({ administratorId: ownerId, status: 'active', baseSalary: 0 }),
    ]);
    const assignments = await connection().query<{ administratorId: number }[]>(
      'SELECT "administratorId" FROM member_role_assignment WHERE "businessId" = $1',
      [businessId],
    );
    expect(assignments).toEqual([{ administratorId: ownerId }]);
  });

  it('converge adds exactly one row per live role holder, the owner included, and a second run adds none', async () => {
    // Arrange
    const a = businesses.a;
    const suffix = randomBytes(3).toString('hex');
    const manager = await grantedMember(a, `manager-${suffix}`, await builtInRoleId(a, 'manager'));
    const demoShaped = await grantedMember(a, `demo-${suffix}`, await demoSeedRole(a));
    const departed = await grantedMember(a, `departed-${suffix}`, await builtInRoleId(a, 'manager'));
    await connection().query('UPDATE administrator SET "deletedAt" = now() WHERE id = $1', [departed]);
    await createMember(server.app, adminClient, {
      code: `norole-${suffix}`,
      business: a,
      store: a.stores[0],
      permissions: [],
    });
    // The owner's row is gone too, as for a business provisioned before Team existed.
    await connection().query('DELETE FROM team_member WHERE "businessId" = $1', [a.businessId]);
    const ownerId = await administratorIdOf(a.owner.email);
    // B also has a role holder with no row, so converge has real work in B to get right or wrong.
    const b = businesses.b;
    const ownerOfB = await administratorIdOf(b.owner.email);
    const managerOfB = await grantedMember(b, `b-manager-${suffix}`, await builtInRoleId(b, 'manager'));
    await connection().query('DELETE FROM team_member WHERE "businessId" = $1 AND "administratorId" = $2', [
      b.businessId,
      managerOfB,
    ]);

    // Act
    const first = await server.app.get(TeamConvergeService).convergeMembers(await context());
    const afterFirst = await membersOf(a.businessId);
    const second = await server.app.get(TeamConvergeService).convergeMembers(await context());

    // Assert
    expect(afterFirst.map((row) => [row.administratorId, row.status])).toEqual(
      [ownerId, manager, demoShaped].sort((x, y) => x - y).map((id) => [id, 'active']),
    );
    expect(first.created).toBe(4);
    expect(second).toEqual({ businesses: first.businesses, created: 0, skipped: 0 });
    expect(await membersOf(a.businessId)).toEqual(afterFirst);
    const rowsOfB = await membersOf(b.businessId);
    expect(rowsOfB.map((row) => [row.administratorId, row.businessId, row.status])).toEqual(
      [ownerOfB, managerOfB].sort((x, y) => x - y).map((id) => [id, b.businessId, 'active']),
    );
    const administratorsOfB: readonly (number | null)[] = [ownerOfB, managerOfB];
    expect(afterFirst.filter((row) => administratorsOfB.includes(row.administratorId))).toEqual([]);
  });
});
