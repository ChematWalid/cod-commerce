import { SNOWFLAKE_ID_GENERATOR } from '@cod/plugin-tenancy';
import { BUILT_IN_ROLES, vendurePermissionName } from '@cod/shared';
import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { RequestContextService, Role } from '@vendure/core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RbacConvergeService, type RbacConvergePorts } from '../../application/rbac-converge.service';
import {
  BUSINESS_DIRECTORY,
  BUSINESS_ROLES,
  CLOCK,
  ENGINE_ROLES,
  MEMBER_ASSIGNMENTS,
  RBAC_LOCK,
  ROLE_BINDINGS,
  SESSION_FLUSHER,
  TRANSACTION,
} from '../../application/tokens';
import { ALL_STORES_SCOPE } from '../../domain/constants';
import { RbacConvergeFailedError } from '../../domain/errors';
import type { MemberAssignmentRepositoryPort } from '../../domain/ports/member-assignment-repository.port';
import type { RoleBindingRepositoryPort } from '../../domain/ports/role-binding-repository.port';
import type { SessionFlusherPort } from '../../domain/ports/session-flusher.port';
import { RoleBindingEntity } from '../../infrastructure/role-binding.entity';
import { CANCEL_ORDER } from './built-in-roles-kit';
import { createConvergeKit, UPDATE_STORE } from './converge-kit';
import { actAs } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';

const SNOWFLAKE_WORKER_ID = 1015;
const BUILT_IN_COUNT = 7;
const BUSINESS_COUNT = 2;

describe('Converging the roles of existing businesses', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  let businesses: TwoBusinesses;

  const kit = createConvergeKit(server, adminClient);
  const {
    repository,
    businessRow,
    rolesOf,
    assignmentsOf,
    vendureRole,
    channelOf,
    context,
    engine,
    converge,
    sessionTokens,
    spyOnCacheDelete,
    deletedTokens,
    arrangeOldBusiness,
  } = kit;

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await server.destroy();
  });

  describe('a business from before this feature', () => {
    it('keeps its owner in, on the same Vendure role, and grants the catalog on the session already held', async () => {
      const { businessId, owner, stores } = businesses.a;
      await arrangeOldBusiness(businessId);
      await actAs(adminClient, owner, stores[0]);
      await adminClient.query(UPDATE_STORE, { id: stores[0].id, input: { name: 'Before converge' } });
      expect((await failureOf(adminClient.query(CANCEL_ORDER))).codes).toEqual(['FORBIDDEN']);
      const { ownerRoleId, ownerAdministratorId } = await businessRow(businessId);
      const tokens = await sessionTokens(owner);
      const deleted = spyOnCacheDelete();

      const report = await converge().convergeAll(await context());

      expect(report).toEqual({ businesses: BUSINESS_COUNT, changed: 1 });
      expect(deletedTokens(deleted)).toEqual(expect.arrayContaining(tokens));
      expect((await businessRow(businessId)).ownerRoleId).toBe(ownerRoleId);
      expect(await rolesOf(businessId)).toHaveLength(BUILT_IN_COUNT);
      expect(await assignmentsOf(businessId)).toEqual([
        expect.objectContaining({ administratorId: ownerAdministratorId, storeAccess: ALL_STORES_SCOPE }),
      ]);
      await expect(
        adminClient.query(UPDATE_STORE, { id: stores[0].id, input: { name: 'After converge' } }),
      ).resolves.toMatchObject({ updateStore: { id: stores[0].id } });
      await expect(adminClient.query(CANCEL_ORDER)).resolves.toEqual({ rbacTestCancelOrder: true });
    });

    it('binds Owner to the Vendure role the business already had', async () => {
      const { businessId } = businesses.a;
      const { ownerRoleId } = await businessRow(businessId);
      const owner = (await rolesOf(businessId)).find((row) => row.builtInKey === 'owner');

      const bindings = await repository(RoleBindingEntity).findBy({ businessId });

      expect(bindings).toEqual([
        expect.objectContaining({ businessRoleId: owner?.id, scope: ALL_STORES_SCOPE, vendureRoleId: ownerRoleId }),
      ]);
    });

    it('changes nothing and flushes nobody on a second run', async () => {
      const before = await Promise.all([rolesOf(businesses.a.businessId), rolesOf(businesses.b.businessId)]);
      const deleted = spyOnCacheDelete();
      const writes = [
        vi.spyOn(engine(), 'updatePermissions'),
        vi.spyOn(engine(), 'addChannel'),
        vi.spyOn(server.app.get<RoleBindingRepositoryPort>(ROLE_BINDINGS), 'insert'),
        vi.spyOn(server.app.get<MemberAssignmentRepositoryPort>(MEMBER_ASSIGNMENTS), 'insert'),
      ];

      const ctx = await context();
      const contextsBuilt = vi.spyOn(server.app.get(RequestContextService), 'create');

      const report = await converge().convergeAll(ctx);

      expect(report).toEqual({ businesses: BUSINESS_COUNT, changed: 0 });
      expect(contextsBuilt).toHaveBeenCalledTimes(BUSINESS_COUNT);
      expect(await Promise.all([rolesOf(businesses.a.businessId), rolesOf(businesses.b.businessId)])).toEqual(before);
      expect(deleted).not.toHaveBeenCalled();
      for (const write of writes) expect(write).not.toHaveBeenCalled();
    });
  });

  describe('a later change', () => {
    const managerTemplate = BUILT_IN_ROLES.find((template) => template.key === 'manager');
    const removed = managerTemplate?.permissions[0];

    /** The converge service on the real adapters, with a catalog of templates as a later release would ship it. */
    const convergeWithTemplates = (templates: RbacConvergePorts['templates']): RbacConvergeService =>
      new RbacConvergeService({
        lock: server.app.get(RBAC_LOCK),
        roles: server.app.get(BUSINESS_ROLES),
        bindings: server.app.get(ROLE_BINDINGS),
        assignments: server.app.get(MEMBER_ASSIGNMENTS),
        engine: server.app.get(ENGINE_ROLES),
        directory: server.app.get(BUSINESS_DIRECTORY),
        transaction: server.app.get(TRANSACTION),
        flusher: server.app.get(SESSION_FLUSHER),
        ids: server.app.get(SNOWFLAKE_ID_GENERATOR),
        clock: server.app.get(CLOCK),
        templates,
      });

    it("takes a template change to the role, its Vendure role and every holder's session, and to no other holder", async () => {
      const { businessId } = businesses.a;
      const { roleId, member, memberId } = await kit.arrangeManagerMember(
        businesses.a,
        managerTemplate?.permissions ?? [],
      );
      const memberTokens = await sessionTokens(member);
      const deleted = spyOnCacheDelete();
      const flushed = vi.spyOn(server.app.get<SessionFlusherPort>(SESSION_FLUSHER), 'flushAdministrators');
      const templates = BUILT_IN_ROLES.map((template) =>
        template.key === 'manager'
          ? { ...template, permissions: template.permissions.filter((key) => key !== removed) }
          : template,
      );

      const report = await convergeWithTemplates(templates).convergeAll(await context());

      expect(report).toEqual({ businesses: BUSINESS_COUNT, changed: 2 });
      const manager = (await rolesOf(businessId)).find((row) => row.builtInKey === 'manager');
      expect(manager?.permissions).not.toContain(removed);
      expect((await vendureRole(roleId)).permissions).not.toContain(vendurePermissionName(removed ?? 'orders.cancel'));
      expect(deletedTokens(deleted)).toEqual(expect.arrayContaining(memberTokens));
      expect(flushed.mock.calls.flatMap(([administratorIds]) => administratorIds)).toEqual([memberId]);
    });

    it('restores the shipped template on the next run', async () => {
      const report = await converge().convergeAll(await context());

      expect(report).toEqual({ businesses: BUSINESS_COUNT, changed: 2 });
      const manager = (await rolesOf(businesses.a.businessId)).find((row) => row.builtInKey === 'manager');
      expect(manager?.permissions).toContain(removed);
    });

    it("puts a store channel an all-stores binding lacks back on that role, and flushes the holder's session", async () => {
      const { businessId, owner, stores } = businesses.b;
      const { ownerRoleId } = await businessRow(businessId);
      const missing = await channelOf(stores[1]);
      await repository(Role).createQueryBuilder().relation(Role, 'channels').of(ownerRoleId).remove(missing.id);
      await actAs(adminClient, owner, stores[0]);
      await adminClient.query(CANCEL_ORDER);
      const tokens = await sessionTokens(owner);
      const deleted = spyOnCacheDelete();

      const report = await converge().convergeAll(await context());

      expect(report).toEqual({ businesses: BUSINESS_COUNT, changed: 1 });
      expect((await vendureRole(ownerRoleId)).channels.map((channel) => channel.token)).toContain(
        stores[1].channelToken,
      );
      expect(deletedTokens(deleted)).toEqual(expect.arrayContaining(tokens));
      adminClient.setChannelToken(stores[1].channelToken);
      await expect(adminClient.query(CANCEL_ORDER)).resolves.toEqual({ rbacTestCancelOrder: true });
    });
  });

  describe('a failure on one business', () => {
    it('undoes that business only, finishes the others and reports it', async () => {
      const [failing, healthy] = [businesses.a.businessId, businesses.b.businessId];
      await arrangeOldBusiness(failing);
      await arrangeOldBusiness(healthy);
      const bindings = server.app.get<RoleBindingRepositoryPort>(ROLE_BINDINGS);
      const insert = bindings.insert.bind(bindings);
      vi.spyOn(bindings, 'insert').mockImplementation((ctx, scope, binding) =>
        scope.businessId === failing
          ? Promise.reject(new Error('forced converge failure'))
          : insert(ctx, scope, binding),
      );

      const failure = await converge()
        .convergeAll(await context())
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(RbacConvergeFailedError);
      expect(failure).toMatchObject({
        businesses: BUSINESS_COUNT,
        changed: 1,
        failures: [{ businessId: failing, reason: 'forced converge failure' }],
      });
      expect(await rolesOf(failing)).toHaveLength(0);
      expect(await rolesOf(healthy)).toHaveLength(BUILT_IN_COUNT);
      expect(await assignmentsOf(healthy)).toHaveLength(1);

      vi.restoreAllMocks();
      await expect(converge().convergeAll(await context())).resolves.toEqual({
        businesses: BUSINESS_COUNT,
        changed: 1,
      });
      expect(await rolesOf(failing)).toHaveLength(BUILT_IN_COUNT);
    });

    it('undoes a Vendure role write made before the failure', async () => {
      const { businessId } = businesses.a;
      await arrangeOldBusiness(businessId);
      const { ownerRoleId } = await businessRow(businessId);
      const before = (await vendureRole(ownerRoleId)).permissions;
      const write = vi.spyOn(engine(), 'updatePermissions');
      const assignments = server.app.get<MemberAssignmentRepositoryPort>(MEMBER_ASSIGNMENTS);
      vi.spyOn(assignments, 'holdersOf').mockRejectedValueOnce(new Error('forced failure after the role write'));

      const failure = await converge()
        .convergeAll(await context())
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(RbacConvergeFailedError);
      expect(write).toHaveBeenCalledWith(expect.anything(), ownerRoleId, expect.anything());
      expect((await vendureRole(ownerRoleId)).permissions).toEqual(before);
      expect(await rolesOf(businessId)).toHaveLength(0);

      vi.restoreAllMocks();
      await expect(converge().convergeAll(await context())).resolves.toEqual({
        businesses: BUSINESS_COUNT,
        changed: 1,
      });
    });
  });
});
