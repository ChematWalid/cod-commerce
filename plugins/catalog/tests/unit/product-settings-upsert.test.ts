import type { TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { QueryFailedError } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { ConcurrentUpdateError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context';
import { TypeOrmProductSettingsRepository } from '../../infrastructure/typeorm-product-settings.repository';
import { newCoreId, scopeA, settingsOf } from '../support/builders';

/** A settings table where no row matches the update and the insert fails with `insertError`. */
function repositoryWhoseInsertFails(insertError: Error): TypeOrmProductSettingsRepository {
  const rows = {
    update: () => Promise.resolve(0),
    insert: () => Promise.reject(insertError),
  };
  const factory = { for: () => rows } as unknown as TenantRepositoryFactory;
  return new TypeOrmProductSettingsRepository(factory);
}

const ctx = asOperationContext({});

describe('TypeOrmProductSettingsRepository.upsert', () => {
  it('reports a parallel first save of the same product as a concurrent update', async () => {
    // Arrange
    const uniqueViolation = new QueryFailedError('INSERT …', [], Object.assign(new Error('dup'), { code: '23505' }));
    const repo = repositoryWhoseInsertFails(uniqueViolation);

    // Act
    const upsert = repo.upsert(ctx, scopeA, settingsOf(scopeA, newCoreId()));

    // Assert
    await expect(upsert).rejects.toBeInstanceOf(ConcurrentUpdateError);
  });

  it('rethrows any other insert failure unchanged', async () => {
    // Arrange
    const otherFailure = new QueryFailedError('INSERT …', [], Object.assign(new Error('down'), { code: '57P01' }));
    const repo = repositoryWhoseInsertFails(otherFailure);

    // Act
    const upsert = repo.upsert(ctx, scopeA, settingsOf(scopeA, newCoreId()));

    // Assert
    await expect(upsert).rejects.toBe(otherFailure);
  });
});
