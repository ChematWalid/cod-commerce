import { randomBytes } from 'node:crypto';
import { SNOWFLAKE_ID_GENERATOR, type SnowflakeIdGeneratorPort } from '@cod/plugin-tenancy';
import { toBusinessId, toSnowflake } from '@cod/shared';
import {
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  type StoreFixture,
  type TwoBusinesses,
} from '@cod/testing';
import {
  Administrator,
  Channel,
  RequestContextService,
  Role,
  Seller,
  TransactionalConnection,
  User,
} from '@vendure/core';
import type { EntityTarget, ObjectLiteral } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ENGINE_ROLES, RBAC_LOCK, ROLE_BINDINGS, SESSION_FLUSHER } from '../../application/tokens';
import { ALL_STORES_SCOPE } from '../../domain/constants';
import type { EngineRolesPort } from '../../domain/ports/engine-roles.port';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { RbacLockPort } from '../../domain/ports/rbac-lock.port';
import type { RoleBindingRepositoryPort } from '../../domain/ports/role-binding-repository.port';
import type { SessionFlusherPort } from '../../domain/ports/session-flusher.port';
import { BusinessRoleEntity } from '../../infrastructure/business-role.entity';
import { MemberRoleAssignmentEntity } from '../../infrastructure/member-role-assignment.entity';
import { RoleBindingEntity } from '../../infrastructure/role-binding.entity';
import { CREATE_STORE, PROVISION_BUSINESS } from './built-in-roles-kit';
import { actAs } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';

const SNOWFLAKE_WORKER_ID = 1016;
const WAITING_ON_ADVISORY_LOCK_SQL = `
  SELECT count(*)::int AS waiting FROM pg_locks
  WHERE locktype = 'advisory' AND NOT granted
    AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`;

const suffix = (): string => randomBytes(3).toString('hex');

const provisionInput = (slug: string): Record<string, unknown> => ({
  input: {
    name: `${slug} SARL`,
    owner: {
      emailAddress: `${slug}@example.test`,
      firstName: 'F',
      lastName: 'Owner',
      password: 'synthetic-owner-password',
    },
    store: { name: `${slug} store`, subdomain: slug, language: 'ar' },
  },
});

describe('The transactions around built-in roles', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  let businesses: TwoBusinesses;

  const connection = (): TransactionalConnection => server.app.get(TransactionalConnection);
  const count = (entity: EntityTarget<ObjectLiteral>): Promise<number> =>
    connection().rawConnection.getRepository(entity).count();
  const rowCounts = (): Promise<number[]> =>
    Promise.all(
      [
        'BusinessEntity',
        'StoreEntity',
        Channel,
        Role,
        Seller,
        User,
        Administrator,
        BusinessRoleEntity,
        RoleBindingEntity,
        MemberRoleAssignmentEntity,
      ].map((entity) => count(entity as EntityTarget<ObjectLiteral>)),
    );
  const asPlatform = async (): Promise<void> => {
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
  };

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('creates exactly one Vendure role per provisioning', async () => {
    await asPlatform();
    const before = await count(Role);

    await adminClient.query(PROVISION_BUSINESS, provisionInput(`single-${suffix()}`));

    expect(await count(Role)).toBe(before + 1);
  });

  it('leaves nothing behind when the seed fails partway, and flushes no session for it', async () => {
    await asPlatform();
    const before = await rowCounts();
    const flush = vi.spyOn(server.app.get<SessionFlusherPort>(SESSION_FLUSHER), 'flushAdministrators');
    const failing = vi
      .spyOn(server.app.get<RoleBindingRepositoryPort>(ROLE_BINDINGS), 'insert')
      .mockRejectedValueOnce(new Error('forced seed failure'));

    const failure = await failureOf(adminClient.query(PROVISION_BUSINESS, provisionInput(`failing-${suffix()}`)));

    expect(failing).toHaveBeenCalledOnce();
    failing.mockRestore();
    expect(failure.codes.length).toBeGreaterThan(0);
    expect(await rowCounts()).toEqual(before);

    // Positive control: the event of a later commit is delivered, so the rolled-back one had its chance.
    await adminClient.query(PROVISION_BUSINESS, provisionInput(`after-${suffix()}`));
    await vi.waitFor(() => {
      expect(flush).toHaveBeenCalled();
    });
    expect(flush).toHaveBeenCalledOnce();
    flush.mockRestore();
  });

  it('makes a store opened during a binding creation wait for it, then extends that binding', async () => {
    const { a } = businesses;
    await actAs(adminClient, a.owner, a.stores[0]);
    const channel = await connection()
      .rawConnection.getRepository(Channel)
      .findOneByOrFail({ token: a.stores[0].channelToken });
    const businessRole = await connection()
      .rawConnection.getRepository(BusinessRoleEntity)
      .findOneByOrFail({ businessId: a.businessId, builtInKey: 'manager' });
    const root = await server.app.get(RequestContextService).create({ apiType: 'admin' });
    let roleId = 0;
    let opening: Promise<{ createStore: StoreFixture }> | undefined;

    await connection().withTransaction(root, async (txRoot) => {
      const tx = asOperationContext(txRoot);
      await server.app.get<RbacLockPort>(RBAC_LOCK).acquire(tx, toBusinessId(a.businessId));
      roleId = await server.app
        .get<EngineRolesPort>(ENGINE_ROLES)
        .createRole(tx, { code: `race-${suffix()}`, permissions: [], channelIds: [channel.id as number] });
      await server.app.get<RoleBindingRepositoryPort>(ROLE_BINDINGS).insert(
        tx,
        { businessId: toBusinessId(a.businessId) },
        {
          id: server.app.get<SnowflakeIdGeneratorPort>(SNOWFLAKE_ID_GENERATOR).next(),
          businessRoleId: toSnowflake(businessRole.id),
          scope: ALL_STORES_SCOPE,
          vendureRoleId: roleId,
        },
      );
      opening = adminClient.query<{ createStore: StoreFixture }>(CREATE_STORE, {
        input: { name: 'race', subdomain: `race-${suffix()}`, language: 'ar' },
      });
      // The store's transaction is now parked on the lock this one holds, and must see the binding once it commits.
      await vi.waitFor(
        async () => {
          const [row] = await connection().rawConnection.query<{ waiting: number }[]>(WAITING_ON_ADVISORY_LOCK_SQL);
          expect(row?.waiting).toBe(1);
        },
        { timeout: 15_000, interval: 50 },
      );
    });

    const store = await opening;
    const role = await connection()
      .rawConnection.getRepository(Role)
      .findOneOrFail({ where: { id: roleId }, relations: { channels: true } });
    expect(role.channels.map((entry) => entry.token)).toContain(store?.createStore.channelToken);
  });
});
