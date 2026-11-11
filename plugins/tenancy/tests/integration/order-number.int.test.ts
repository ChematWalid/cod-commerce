import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import type { BusinessId } from '@cod/shared';
import { RequestContextService, TransactionalConnection, type RequestContext } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BusinessNotFoundError, TransactionRequiredError } from '../../domain/errors';
import { OrderNumberService } from '../../infrastructure/order-number.service';
import { provisionBusiness, tenancyTestPlugins, UPDATE_GLOBAL_LANGUAGES } from './tenant-fixtures';

const CONCURRENT_ON_A = 50;
const CONCURRENT_ON_B = 10;
const ROLLED_BACK_EVERY = 5;
const POOL_SIZE = 60;

class Rollback extends Error {}

const numbering = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `#${String(index + 1).padStart(8, '0')}`);

describe('Per-business order numbers', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: tenancyTestPlugins(1000),
    db: loadPluginTestDbConfig(process.env),
    poolSize: POOL_SIZE,
  });

  const anonymousContext = (): Promise<RequestContext> =>
    server.app.get(RequestContextService).create({ apiType: 'admin' });

  /** Takes a number in its own transaction; every nth attempt rolls back after taking it. */
  async function takeInTransaction(businessId: BusinessId, attempt: number): Promise<string | undefined> {
    const ctx = await anonymousContext();
    try {
      return await server.app.get(TransactionalConnection).withTransaction(ctx, async (txCtx) => {
        const number = await server.app.get(OrderNumberService).nextOrderNumber(txCtx, businessId);
        if (attempt % ROLLED_BACK_EVERY === 0) throw new Rollback();
        return number;
      });
    } catch (error) {
      if (error instanceof Rollback) return undefined;
      throw error;
    }
  }

  async function takeMany(businessId: BusinessId, count: number): Promise<string[]> {
    const results = await Promise.all(
      Array.from({ length: count }, (_, index) => takeInTransaction(businessId, index + 1)),
    );
    return results.filter((value): value is string => value !== undefined).sort();
  }

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('numbers each business from 1 with no duplicate and no gap, rollbacks included', async () => {
    // Arrange
    const a = (await provisionBusiness(server.app, 'seqa')).business.id as unknown as BusinessId;
    const b = (await provisionBusiness(server.app, 'seqb')).business.id as unknown as BusinessId;

    // Act
    const [numbersA, numbersB] = await Promise.all([takeMany(a, CONCURRENT_ON_A), takeMany(b, CONCURRENT_ON_B)]);

    // Assert
    expect(numbersA).toEqual(numbering(CONCURRENT_ON_A - CONCURRENT_ON_A / ROLLED_BACK_EVERY));
    expect(numbersB).toEqual(numbering(CONCURRENT_ON_B - CONCURRENT_ON_B / ROLLED_BACK_EVERY));
  });

  it('refuses to number outside a transaction', async () => {
    // Arrange
    const business = (await provisionBusiness(server.app, 'seqc')).business.id as unknown as BusinessId;
    const ctx = await anonymousContext();

    // Act
    const attempt = server.app.get(OrderNumberService).nextOrderNumber(ctx, business);

    // Assert
    await expect(attempt).rejects.toBeInstanceOf(TransactionRequiredError);
  });

  it('refuses a business that has no sequence', async () => {
    // Arrange
    const ctx = await anonymousContext();

    // Act
    const attempt = server.app
      .get(TransactionalConnection)
      .withTransaction(ctx, (txCtx) =>
        server.app.get(OrderNumberService).nextOrderNumber(txCtx, '999999999999' as BusinessId),
      );

    // Assert
    await expect(attempt).rejects.toBeInstanceOf(BusinessNotFoundError);
  });
});
