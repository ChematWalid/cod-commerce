import type { TransactionalConnection } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { ClaimTransactionRequiredError } from '../../domain/errors';
import type { OperationContext } from '../../domain/ports/operation-context';
import { EmailClaimLock } from '../../infrastructure/email-claim-lock';

const CTX = {} as OperationContext;

function lockOver(queryRunner: { isTransactionActive: boolean } | undefined) {
  const query = vi.fn(() => Promise.resolve([]));
  const connection = {
    getRepository: () => ({ manager: { queryRunner, query } }),
  } as unknown as TransactionalConnection;
  return { lock: new EmailClaimLock(connection), query };
}

describe('EmailClaimLock.claim', () => {
  it('takes the advisory lock inside an open transaction', async () => {
    // Arrange
    const { lock, query } = lockOver({ isTransactionActive: true });

    // Act
    await lock.claim(CTX, 'sara@example.test');

    // Assert
    expect(query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), ['sara@example.test']);
  });

  it('refuses a context with no query runner, as the lock would end with its own statement', async () => {
    // Arrange
    const { lock, query } = lockOver(undefined);

    // Act
    const attempt = lock.claim(CTX, 'sara@example.test');

    // Assert
    await expect(attempt).rejects.toBeInstanceOf(ClaimTransactionRequiredError);
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses a query runner whose transaction is not open', async () => {
    // Arrange
    const { lock, query } = lockOver({ isTransactionActive: false });

    // Act
    const attempt = lock.claim(CTX, 'sara@example.test');

    // Assert
    await expect(attempt).rejects.toBeInstanceOf(ClaimTransactionRequiredError);
    expect(query).not.toHaveBeenCalled();
  });
});
