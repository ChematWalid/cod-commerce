import { describe, expect, it } from 'vitest';
import { InvalidSnowflakeError, toBusinessId, toStoreId, type TenantContext } from '../src/index';

describe('toStoreId', () => {
  it('brands a valid id', () => {
    expect(toStoreId('123')).toBe('123');
  });

  it('rejects an invalid id', () => {
    expect(() => toStoreId('0')).toThrow(InvalidSnowflakeError);
  });

  it('builds a tenant context', () => {
    const activeStoreId = toStoreId('5');
    const context: TenantContext = {
      businessId: toBusinessId('1'),
      storeIds: [activeStoreId],
      activeStoreId,
    };
    expect(context.storeIds).toContain(context.activeStoreId);
  });
});
