import type { TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { QueryFailedError } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { ConcurrentUpdateError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context';
import { TypeOrmMediaRepository } from '../../infrastructure/typeorm-media.repository';
import { mediaOf, scopeA } from '../support/builders';

/** `catalog_media` whose insert fails with `insertError`. */
function factoryWhoseInsertFails(insertError: Error): TenantRepositoryFactory {
  const rows = { insert: () => Promise.reject(insertError) };
  return { for: () => rows } as unknown as TenantRepositoryFactory;
}

const ctx = asOperationContext({});
const driverError = (code: string) => Object.assign(new Error('catalog_media_businessId_assetId_key'), { code });

describe('TypeOrmMediaRepository.insert under a second row for one asset', () => {
  it('reports the unique (businessId, assetId) violation as a concurrent update, not the driver error', async () => {
    // Arrange
    const repo = new TypeOrmMediaRepository(
      factoryWhoseInsertFails(new QueryFailedError('INSERT …', [], driverError('23505'))),
    );

    // Act
    const inserting = repo.insert(ctx, scopeA, mediaOf(scopeA));

    // Assert
    await expect(inserting).rejects.toBeInstanceOf(ConcurrentUpdateError);
  });

  it('rethrows any other failure unchanged', async () => {
    // Arrange
    const failure = new QueryFailedError('INSERT …', [], driverError('57P01'));
    const repo = new TypeOrmMediaRepository(factoryWhoseInsertFails(failure));

    // Act
    const inserting = repo.insert(ctx, scopeA, mediaOf(scopeA));

    // Assert
    await expect(inserting).rejects.toBe(failure);
  });
});
