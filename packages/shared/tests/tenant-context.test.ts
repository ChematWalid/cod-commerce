import { describe, expect, it } from 'vitest';
import { InvalidSnowflakeError, toStoreId } from '../src/index';

describe('toStoreId', () => {
  it('brands a valid id', () => {
    expect(toStoreId('123')).toBe('123');
  });

  it('rejects an invalid id', () => {
    expect(() => toStoreId('0')).toThrow(InvalidSnowflakeError);
  });
});
