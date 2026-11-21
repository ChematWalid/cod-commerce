import { TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { toBusinessId, toStoreId } from '@cod/shared';
import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { type RequestContext, RequestContextService, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CorruptCollectionDefinitionError } from '../../domain/corrupt-collection-definition.error';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import { StoreChannelContexts } from '../../infrastructure/store-channel-context';
import { TypeOrmCollectionDefinitionRepository } from '../../infrastructure/typeorm-collection-definition.repository';
import { definitionOf, scopeA } from '../support/builders';
import { createCollectionsTestEnvironment } from './collections-kit';

const { server, adminClient } = createCollectionsTestEnvironment(1017, { plugins: [], partitionedSchemas: [] });

let ctx: OperationContext;
let fixtures: TwoBusinesses;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  ctx = asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
  fixtures = await createTwoBusinesses(adminClient);
});

afterAll(async () => {
  await server.destroy();
});

const connection = () => server.app.get(TransactionalConnection);
const definitions = () => new TypeOrmCollectionDefinitionRepository(server.app.get(TenantRepositoryFactory));

/** Test-only direct write, standing for a row edited by hand or by a faulty migration. */
async function corrupt(collectionId: string, column: 'mode' | 'rule', value: string): Promise<void> {
  await connection().rawConnection.query(
    `UPDATE collections_definition SET "${column}" = $1 WHERE "collectionId" = $2`,
    [value, collectionId],
  );
}

describe('a stored definition that breaks the stored shape', () => {
  it.each([
    ['an unknown mode', 'mode' as const, 'sideways'],
    ['a rule the shared schema refuses', 'rule' as const, JSON.stringify({ version: 99, conditions: 'none' })],
  ])('is refused on read with the corrupt-row error for %s', async (_case, column, value) => {
    // Arrange
    const definition = definitionOf(scopeA);
    await definitions().insert(ctx, scopeA, definition);
    await corrupt(definition.collectionId, column, value);

    // Act
    const read = definitions().findByCollectionId(ctx, scopeA, definition.collectionId);

    // Assert
    await expect(read).rejects.toBeInstanceOf(CorruptCollectionDefinitionError);
    await expect(read).rejects.toMatchObject({ definitionId: definition.id });
  });
});

describe('StoreChannelContexts.forStore', () => {
  const contexts = () => server.app.get(StoreChannelContexts);
  const scopeOf = (storeIndex: 0 | 1): StoreScope => ({
    businessId: toBusinessId(fixtures.a.businessId),
    storeId: toStoreId(fixtures.a.stores[storeIndex].id),
  });
  const forStore = (from: RequestContext, scope: StoreScope) =>
    contexts().forStore(from, scope.businessId, scope.storeId);

  it("answers nothing for another business's active store, and a context for the owner", async () => {
    // Arrange
    const vendureCtx = ctx as unknown as RequestContext;
    const active = scopeOf(0);
    const foreign = { businessId: toBusinessId(fixtures.b.businessId), storeId: active.storeId };

    // Act
    const [asForeign, asOwner] = await Promise.all([forStore(vendureCtx, foreign), forStore(vendureCtx, active)]);

    // Assert
    expect(asForeign).toBeUndefined();
    expect(asOwner?.channel.token).toBe(fixtures.a.stores[0].channelToken);
  });

  it('answers nothing for a missing store or an archived one', async () => {
    // Arrange
    const vendureCtx = ctx as unknown as RequestContext;
    const archived = scopeOf(1);
    const missing = { businessId: archived.businessId, storeId: toStoreId('999999999') };
    await connection().rawConnection.query(`UPDATE store SET status = 'archived' WHERE id = $1`, [archived.storeId]);

    // Act
    const answers = await Promise.all([missing, archived].map((scope) => forStore(vendureCtx, scope)));

    // Assert
    expect(answers).toEqual([undefined, undefined]);
  });

  it("gives a context on the store's channel that runs in the caller's transaction", async () => {
    // Arrange
    const scope = scopeOf(0);
    const definition = definitionOf(scope);
    const countOutside = async (): Promise<number> => {
      const rows = await connection().rawConnection.query<{ n: number }[]>(
        'SELECT count(*)::int AS n FROM collections_definition WHERE id = $1',
        [definition.id],
      );
      return rows[0]?.n ?? -1;
    };
    let channelToken: string | undefined;
    let seenOutsideBeforeCommit = -1;

    // Act
    const rolledBack = connection().withTransaction(async (transaction) => {
      const onChannel = await forStore(transaction, scope);
      channelToken = onChannel?.channel.token;
      if (onChannel === undefined) return;
      await definitions().insert(asOperationContext(onChannel), scope, definition);
      seenOutsideBeforeCommit = await countOutside();
      throw new Error('roll back the outer transaction');
    });

    // Assert
    await expect(rolledBack).rejects.toThrow('roll back the outer transaction');
    expect(channelToken).toBe(fixtures.a.stores[0].channelToken);
    expect(seenOutsideBeforeCommit).toBe(0);
    expect(await countOutside()).toBe(0);
  });
});
