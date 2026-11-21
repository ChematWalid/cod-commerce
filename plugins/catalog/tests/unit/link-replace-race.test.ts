import type { TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { QueryFailedError } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { ConcurrentUpdateError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context';
import { TypeOrmHighlightRepository } from '../../infrastructure/typeorm-highlight.repository';
import { TypeOrmProductCollectionRepository } from '../../infrastructure/typeorm-product-collection.repository';
import { TypeOrmTagRepository } from '../../infrastructure/typeorm-tag.repository';
import { newCoreId, newId, scopeA } from '../support/builders';

/** Link tables whose delete finds nothing and whose insert fails with `insertError`. */
function factoryWhoseInsertFails(insertError: Error): TenantRepositoryFactory {
  const rows = {
    delete: () => Promise.resolve(0),
    insert: () => Promise.reject(insertError),
  };
  return { for: () => rows } as unknown as TenantRepositoryFactory;
}

const ctx = asOperationContext({});
const ids = { next: newId };
const uniqueViolation = () => new QueryFailedError('INSERT …', [], Object.assign(new Error('dup'), { code: '23505' }));
const otherFailure = () => new QueryFailedError('INSERT …', [], Object.assign(new Error('down'), { code: '57P01' }));

type Replace = (factory: TenantRepositoryFactory) => Promise<void>;

const REPLACES: readonly (readonly [string, Replace])[] = [
  ['tags', (factory) => new TypeOrmTagRepository(factory, ids).replaceProductTags(ctx, scopeA, newCoreId(), [newId()])],
  [
    'highlights',
    (factory) =>
      new TypeOrmHighlightRepository(factory, ids).replaceProductHighlights(ctx, scopeA, newCoreId(), [newId()]),
  ],
  [
    'collections',
    (factory) =>
      new TypeOrmProductCollectionRepository(factory, ids).replaceProductCollections(ctx, scopeA, newCoreId(), [
        newCoreId(),
      ]),
  ],
];

describe('product link replace under a parallel save', () => {
  it.each(REPLACES)('reports a unique violation on %s links as a concurrent update', async (_links, replace) => {
    // Act
    const replacing = replace(factoryWhoseInsertFails(uniqueViolation()));

    // Assert
    await expect(replacing).rejects.toBeInstanceOf(ConcurrentUpdateError);
  });

  it.each(REPLACES)('rethrows any other failure on %s links unchanged', async (_links, replace) => {
    // Arrange
    const failure = otherFailure();

    // Act
    const replacing = replace(factoryWhoseInsertFails(failure));

    // Assert
    await expect(replacing).rejects.toBe(failure);
  });
});
