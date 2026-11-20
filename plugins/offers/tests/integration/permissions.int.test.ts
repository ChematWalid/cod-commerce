import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { BUILT_IN_ROLES, type PermissionKey } from '@cod/shared';
import { failureOf } from '@cod/testing';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import { OFFER_PERMISSIONS } from '../../api/permissions';
import { type OperationEntry, OPERATION_REGISTRY, ROUTE_REGISTRY, type TargetIds } from './endpoint-registry';
import { aDraftWithACode, offersApiSuite } from './offers-api-kit';

/** One snowflake worker id per offers integration file (D2433, D2525). */
const SNOWFLAKE_WORKER_ID = 977;

const suite = offersApiSuite(SNOWFLAKE_WORKER_ID, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const FORBIDDEN = 'FORBIDDEN';
const FORBIDDEN_STATUS = 403;
const OFFER_KEYS: readonly PermissionKey[] = Object.values(OFFER_PERMISSIONS);
const { view, edit, delete: remove } = OFFER_PERMISSIONS;

/** The offer keys of the built-in manager role: every one but delete (built-in-roles.ts). */
const MANAGER_OFFER_KEYS = (BUILT_IN_ROLES.find((role) => role.key === 'manager')?.permissions ?? []).filter((key) =>
  OFFER_KEYS.includes(key),
);

/** The error codes of one registry operation. */
async function codesOf(entry: OperationEntry, ids: TargetIds): Promise<readonly string[]> {
  return (await failureOf(suite.kit.client.query(gql(entry.document), entry.variables(ids)))).codes;
}

/** Every offer key but the one a handler requires: a role that can do everything else. */
const allKeysBut = (access: PermissionKey): PermissionKey[] => OFFER_KEYS.filter((key) => key !== access);

const viewOperations = OPERATION_REGISTRY.filter((entry) => entry.access === view);
const editOperations = OPERATION_REGISTRY.filter((entry) => entry.access === edit);
const deleteOperations = OPERATION_REGISTRY.filter((entry) => entry.access === remove);
const deleteRoutes = ROUTE_REGISTRY.filter((entry) => entry.access === remove);

describe('offers handlers refuse a role that lacks their key', () => {
  let ids: TargetIds;

  beforeAll(async () => {
    const { a } = suite.fixtures;
    ids = await aDraftWithACode(suite, a, a.stores[0], 'GUARD10');
  });

  it('gives the manager every offer key but delete (the role the delete cells sign in with)', () => {
    // Assert
    expect([...MANAGER_OFFER_KEYS].sort()).toEqual(allKeysBut(remove).sort());
  });

  it.each(viewOperations)('$operation is FORBIDDEN for a role without offers.view', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, allKeysBut(view));

    // Act
    const codes = await codesOf(entry, ids);

    // Assert
    expect(codes).toEqual([FORBIDDEN]);
  });

  it.each(editOperations)('$operation is FORBIDDEN for a role without offers.edit', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, allKeysBut(edit));

    // Act
    const codes = await codesOf(entry, ids);

    // Assert
    expect(codes).toEqual([FORBIDDEN]);
  });

  it.each(deleteOperations)('$operation is FORBIDDEN for a manager', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, MANAGER_OFFER_KEYS);

    // Act
    const codes = await codesOf(entry, ids);

    // Assert
    expect(codes).toEqual([FORBIDDEN]);
  });

  it.each(deleteRoutes)('$method $route answers 403 for a manager', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, MANAGER_OFFER_KEYS);

    // Act
    const answer = await suite.kit.rest(entry.method, entry.url(ids), entry.body?.(ids));

    // Assert
    expect(answer.status).toBe(FORBIDDEN_STATUS);
  });

  it.each(OPERATION_REGISTRY.filter((entry) => entry.access !== view))(
    '$operation is FORBIDDEN for a role holding only offers.view',
    async (entry) => {
      // Arrange
      await suite.kit.signInAsMember(suite.fixtures.a, [view]);

      // Act
      const codes = await codesOf(entry, ids);

      // Assert
      expect(codes).toEqual([FORBIDDEN]);
    },
  );

  it.each(OPERATION_REGISTRY)('$operation is FORBIDDEN for a member with no role', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, []);

    // Act
    const codes = await codesOf(entry, ids);

    // Assert
    expect(codes).toEqual([FORBIDDEN]);
  });

  it.each(OPERATION_REGISTRY)('$operation is FORBIDDEN for a role holding every other offer key', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, allKeysBut(entry.access));

    // Act
    const codes = await codesOf(entry, ids);

    // Assert
    expect(codes).toEqual([FORBIDDEN]);
  });

  it.each(ROUTE_REGISTRY.filter((entry) => entry.access !== view))(
    '$method $route answers 403 for a role holding only offers.view',
    async (entry) => {
      // Arrange
      await suite.kit.signInAsMember(suite.fixtures.a, [view]);

      // Act
      const answer = await suite.kit.rest(entry.method, entry.url(ids), entry.body?.(ids));

      // Assert
      expect(answer.status).toBe(FORBIDDEN_STATUS);
    },
  );

  it.each(ROUTE_REGISTRY)('$method $route answers 403 for a member with no role', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, []);

    // Act
    const answer = await suite.kit.rest(entry.method, entry.url(ids), entry.body?.(ids));

    // Assert
    expect(answer.status).toBe(FORBIDDEN_STATUS);
  });

  it.each(ROUTE_REGISTRY)('$method $route answers 403 for a role holding every other offer key', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, allKeysBut(entry.access));

    // Act
    const answer = await suite.kit.rest(entry.method, entry.url(ids), entry.body?.(ids));

    // Assert
    expect(answer.status).toBe(FORBIDDEN_STATUS);
  });

  it('serves the owner the guarded offer (positive control)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const { offer } = await suite.kit.gql<{ offer: { id: string } | null }>(
      'query ($id: String!) { offer(id: $id) { id } }',
      { id: ids.offerId },
    );

    // Assert
    expect(offer).toEqual({ id: ids.offerId });
  });
});
