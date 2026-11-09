import type { INestApplicationContext } from '@nestjs/common';
import { type RequestContext, TransactionalConnection } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { seedDemoMembers } from '../../src/seed/seed-demo-members';

const ctx = {} as RequestContext;
const OWNER_ROW = { id: 7, customFields: { businessId: '123456789012345678' } };

function appWhere(memberExists: boolean): { app: INestApplicationContext; withTransaction: ReturnType<typeof vi.fn> } {
  const withTransaction = vi.fn();
  const repository = {
    findOneBy: vi.fn().mockResolvedValue(OWNER_ROW),
    existsBy: vi.fn().mockResolvedValue(memberExists),
  };
  const connection = { rawConnection: { getRepository: () => repository }, withTransaction };
  const app = {
    get: (token: unknown) => {
      if (token === TransactionalConnection) return connection;
      throw new Error('only the connection is reachable when nothing is to be created');
    },
  } as unknown as INestApplicationContext;
  return { app, withTransaction };
}

describe('seedDemoMembers', () => {
  it('leaves an existing member alone on a second run', async () => {
    // Arrange
    const { app, withTransaction } = appWhere(true);

    // Act
    const created = await seedDemoMembers(app, ctx, 'owner@demo.example.test', 'synthetic-demo-password');

    // Assert
    expect(created).toEqual([]);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it('writes each missing member in its own transaction', async () => {
    // Arrange
    const { app, withTransaction } = appWhere(false);

    // Act
    await seedDemoMembers(app, ctx, 'owner@demo.example.test', 'synthetic-demo-password');

    // Assert
    expect(withTransaction).toHaveBeenCalledTimes(2);
  });
});
