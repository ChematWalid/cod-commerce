import { SNOWFLAKE_ID_GENERATOR, type SnowflakeIdGeneratorPort, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import { COLLECTIONS_ENTITIES } from '../../infrastructure/collections-entities';
import { STORE_LOCK } from '../../application/tokens';
import type { StoreLockPort } from '../../domain/ports/store-lock.port';
import { StoreLockOutsideTransactionError } from '../../infrastructure/pg-collections-lock';
import { SnowflakeCollectionsIdGenerator } from '../../infrastructure/snowflake-id.generator';
import { TypeOrmCollectionDefinitionRepository } from '../../infrastructure/typeorm-collection-definition.repository';
import { TypeOrmCollectionMemberRepository } from '../../infrastructure/typeorm-collection-member.repository';
import { describeCollectionDefinitionRepositoryContract } from '../contract/collection-definition-repository.contract';
import { describeCollectionMemberRepositoryContract } from '../contract/collection-member-repository.contract';
import { describeCoreIdBoundaryContract } from '../contract/core-id-boundary.contract';
import type { MakeHarness } from '../contract/repository-harness';
import { definitionOf, newCoreId, scopeA, scopeB } from '../support/builders';
import { createCollectionsTestEnvironment } from './collections-kit';

const { server } = createCollectionsTestEnvironment(1016, { plugins: [], partitionedSchemas: [] });

/** How long a second locker is given to (wrongly) get a held lock before the test calls it waiting. */
const WAIT_MS = 300;

const SQL_CONTROL = /^\s*(BEGIN|START TRANSACTION|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET)\b/i;

let ctx: OperationContext;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  ctx = asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
});

afterAll(async () => {
  await server.destroy();
});

const connection = () => server.app.get(TransactionalConnection);

function repositories() {
  const factory = server.app.get(TenantRepositoryFactory);
  const ids = new SnowflakeCollectionsIdGenerator(server.app.get<SnowflakeIdGeneratorPort>(SNOWFLAKE_ID_GENERATOR));
  return {
    definitions: new TypeOrmCollectionDefinitionRepository(factory),
    members: new TypeOrmCollectionMemberRepository(factory, ids),
  };
}

/** Each contract case starts from empty tables (test-only direct access), members first for the FK. */
const typeOrm: MakeHarness = async () => {
  const raw = connection().rawConnection;
  await raw.query(
    `TRUNCATE ${COLLECTIONS_ENTITIES.map((entity) => `"${raw.getMetadata(entity).tableName}"`).join(', ')}`,
  );
  return {
    repos: repositories(),
    ctx,
    memberRowIds: async (scope: StoreScope, collectionId: string) => {
      const rows = await raw.query<{ productId: number; id: string }[]>(
        'SELECT "productId", id FROM collections_member WHERE "businessId" = $1 AND "storeId" = $2 AND "collectionId" = $3',
        [scope.businessId, scope.storeId, collectionId],
      );
      return new Map(rows.map((row) => [String(row.productId), row.id]));
    },
  };
};

describeCollectionDefinitionRepositoryContract('TypeOrmCollectionDefinitionRepository', typeOrm);
describeCollectionMemberRepositoryContract('TypeOrmCollectionMemberRepository', typeOrm);
describeCoreIdBoundaryContract('TypeOrm collection repositories', typeOrm);

/** Runs `work` and counts the SQL statements it sent, transaction control left out. */
async function statementsOf(work: () => Promise<unknown>): Promise<number> {
  const { logger } = connection().rawConnection;
  const original = logger.logQuery.bind(logger);
  let count = 0;
  logger.logQuery = (query, parameters, runner) => {
    if (!SQL_CONTROL.test(query)) count += 1;
    original(query, parameters, runner);
  };
  try {
    await work();
  } finally {
    logger.logQuery = original;
  }
  return count;
}

it('collectionIdsOfProducts answers a batch in one query', async () => {
  // Arrange
  const harness = await typeOrm();
  const collections = [definitionOf(scopeA), definitionOf(scopeA)];
  const products = Array.from({ length: 30 }, () => newCoreId());
  for (const definition of collections) {
    await harness.repos.definitions.insert(ctx, scopeA, definition);
    const rows = products.map((productId, position) => ({ productId, position }));
    await harness.repos.members.replaceMembers(ctx, scopeA, definition.collectionId, rows);
  }

  // Act
  let found: ReadonlyMap<string, readonly string[]> = new Map();
  const statements = await statementsOf(async () => {
    found = await harness.repos.members.collectionIdsOfProducts(ctx, scopeA, products);
  });

  // Assert
  expect(statements).toBe(1);
  expect(found.size).toBe(products.length);
});

it('has the unique, list and member indexes, the store-bound cascading FK and the store checks of D2300', async () => {
  // Act
  const [indexes, foreignKeys, checks] = await Promise.all([
    connection().rawConnection.query<{ indexdef: string }[]>(
      "SELECT indexdef FROM pg_indexes WHERE tablename IN ('collections_definition', 'collections_member')",
    ),
    connection().rawConnection.query<{ definition: string }[]>(
      "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'collections_member'::regclass AND contype = 'f'",
    ),
    connection().rawConnection.query<{ name: string; definition: string }[]>(
      "SELECT conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('collections_definition'::regclass, 'collections_member'::regclass) AND contype = 'c' ORDER BY conname",
    ),
  ]);

  // Assert
  const definitions = indexes.map((row) => row.indexdef).join('\n');
  expect(definitions).toMatch(/UNIQUE INDEX .* ON public\.collections_definition .*\("businessId", "collectionId"\)/);
  expect(definitions).toMatch(
    /UNIQUE INDEX .* ON public\.collections_definition .*\("businessId", "storeId", "collectionId"\)/,
  );
  expect(definitions).toContain('("businessId", "storeId", "position", id)');
  expect(definitions).toMatch(/UNIQUE INDEX .*\("businessId", "collectionId", "productId"\)/);
  expect(definitions).toContain('("businessId", "storeId", "productId")');
  expect(definitions).toContain('("businessId", "collectionId", "position", "productId")');
  expect(foreignKeys.map((row) => row.definition)).toEqual([
    'FOREIGN KEY ("businessId", "storeId", "collectionId") REFERENCES collections_definition("businessId", "storeId", "collectionId") ON DELETE CASCADE',
  ]);
  expect(checks).toEqual([
    { name: 'collections_definition_store_required', definition: 'CHECK (("storeId" IS NOT NULL))' },
    { name: 'collections_member_store_required', definition: 'CHECK (("storeId" IS NOT NULL))' },
  ]);
});

describe('PgCollectionsLock', () => {
  const lock = () => server.app.get<symbol, StoreLockPort>(STORE_LOCK);

  /** Holds the store lock in its own transaction until `release` is called. */
  async function holdLock(storeId: string): Promise<{ release: () => Promise<void> }> {
    let release = (): void => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked = (): void => undefined;
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const done = connection().withTransaction(async (transaction) => {
      await lock().lockStore(asOperationContext(transaction), storeId);
      locked();
      await released;
    });
    await acquired;
    return {
      release: async () => {
        release();
        await done;
      },
    };
  }

  /** Takes the store lock in a new transaction; resolves once it got it. */
  const takeLock = (storeId: string): Promise<void> =>
    connection().withTransaction((transaction) => lock().lockStore(asOperationContext(transaction), storeId));

  const settledWithin = async (work: Promise<void>, ms: number): Promise<boolean> =>
    Promise.race([
      work.then(() => true),
      new Promise<boolean>((resolve) =>
        setTimeout(() => {
          resolve(false);
        }, ms),
      ),
    ]);

  it('the store lock serialises two transactions of one store and not of two stores', async () => {
    // Arrange
    const held = await holdLock(scopeA.storeId);

    // Act
    const sameStore = takeLock(scopeA.storeId);
    const otherStoreGotIt = await settledWithin(takeLock(scopeB.storeId), WAIT_MS * 10);
    const sameStoreGotIt = await settledWithin(sameStore, WAIT_MS);
    await held.release();

    // Assert
    expect(otherStoreGotIt).toBe(true);
    expect(sameStoreGotIt).toBe(false);
    await expect(sameStore).resolves.toBeUndefined();
  });

  it('refuses to lock outside a transaction', async () => {
    // Act
    const outside = lock().lockStore(ctx, scopeA.storeId);

    // Assert
    await expect(outside).rejects.toBeInstanceOf(StoreLockOutsideTransactionError);
  });
});
