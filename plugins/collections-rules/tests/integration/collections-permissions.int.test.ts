import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import type { PermissionKey } from '@cod/shared';
import { failureOf } from '@cod/testing';
import gql from 'graphql-tag';
import { describe, expect, it } from 'vitest';
import { COLLECTION_PERMISSIONS } from '../../api/permissions';
import { createCollection, rawId } from './collections-api';
import { collectionsSuite } from './collections-kit';
import { CollectionsMembers } from './collections-members';
import { createProduct } from './collections-products';
import {
  type OperationEntry,
  OPERATION_REGISTRY,
  type RouteEntry,
  ROUTE_REGISTRY,
  type TargetIds,
} from './collections-registry';

const suite = collectionsSuite(1019, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const FORBIDDEN = 'FORBIDDEN';
const FORBIDDEN_STATUS = 403;
const COLLECTION_KEYS: readonly PermissionKey[] = Object.values(COLLECTION_PERMISSIONS);

/** Every collections key but the one a handler requires: a role that can do everything else. */
const allKeysBut = (access: PermissionKey): PermissionKey[] => COLLECTION_KEYS.filter((key) => key !== access);

/** A fresh collection and product of A's first store, made as the owner, so a delete or a write hits its own target. */
async function freshTargets(): Promise<{ graphql: TargetIds; rest: TargetIds }> {
  await suite.kit.asOwner(suite.fixtures.a);
  const collection = await createCollection(suite.kit);
  const productId = await createProduct(suite.kit, 'Guarded');
  return {
    graphql: { collectionId: collection.id, productId },
    rest: { collectionId: rawId(collection.id), productId: rawId(productId) },
  };
}

/** The error codes of a call; none when it succeeded (`failureOf` refuses a success, so it is told apart first). */
async function codesOf(entry: OperationEntry, ids: TargetIds): Promise<readonly string[]> {
  const call = suite.kit.client.query(gql(entry.document), entry.variables(ids));
  const settled = await call.then(
    () => undefined,
    () => 'failed',
  );
  if (settled === undefined) return [];
  return (await failureOf(call)).codes;
}

async function statusOf(entry: RouteEntry, ids: TargetIds): Promise<number> {
  return (await suite.kit.rest(entry.method, entry.url(ids), entry.body?.(ids))).status;
}

describe('collections handlers check exactly their key (D2314)', () => {
  let shared: CollectionsMembers | undefined;
  // One helper for the file, so each grant set gets one role: a business holds only so many custom roles.
  const members = (): CollectionsMembers => (shared ??= new CollectionsMembers(suite.kit));

  it.each(OPERATION_REGISTRY)('$operation succeeds for a member holding only $access', async (entry) => {
    // Arrange
    const { graphql } = await freshTargets();
    await members().signInAsMember(suite.fixtures.a, [entry.access]);

    // Act
    const codes = await codesOf(entry, graphql);

    // Assert
    expect(codes).toEqual([]);
  });

  it.each(OPERATION_REGISTRY)('$operation is FORBIDDEN for a role holding every other key', async (entry) => {
    // Arrange
    const { graphql } = await freshTargets();
    await members().signInAsMember(suite.fixtures.a, allKeysBut(entry.access));

    // Act
    const codes = await codesOf(entry, graphql);

    // Assert
    expect(codes).toEqual([FORBIDDEN]);
  });

  it.each(OPERATION_REGISTRY)('$operation is FORBIDDEN for a member with no role', async (entry) => {
    // Arrange
    const { graphql } = await freshTargets();
    await members().signInAsMember(suite.fixtures.a, []);

    // Act
    const codes = await codesOf(entry, graphql);

    // Assert
    expect(codes).toEqual([FORBIDDEN]);
  });

  it.each(ROUTE_REGISTRY)('$method $route succeeds for a member holding only $access', async (entry) => {
    // Arrange
    const { rest } = await freshTargets();
    await members().signInAsMember(suite.fixtures.a, [entry.access]);

    // Act
    const status = await statusOf(entry, rest);

    // Assert
    expect(status).toBeLessThan(300);
  });

  it.each(ROUTE_REGISTRY)('$method $route answers 403 for a role holding every other key', async (entry) => {
    // Arrange
    const { rest } = await freshTargets();
    await members().signInAsMember(suite.fixtures.a, allKeysBut(entry.access));

    // Act
    const status = await statusOf(entry, rest);

    // Assert
    expect(status).toBe(FORBIDDEN_STATUS);
  });

  it.each(ROUTE_REGISTRY)('$method $route answers 403 for a member with no role', async (entry) => {
    // Arrange
    const { rest } = await freshTargets();
    await members().signInAsMember(suite.fixtures.a, []);

    // Act
    const status = await statusOf(entry, rest);

    // Assert
    expect(status).toBe(FORBIDDEN_STATUS);
  });
});
