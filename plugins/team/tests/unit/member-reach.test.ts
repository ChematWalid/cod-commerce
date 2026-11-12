import { toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { isMemberInReach } from '../../domain/member-reach';

const S1 = toSnowflake('11');
const S2 = toSnowflake('22');

describe('isMemberInReach', () => {
  it('lets an all-store actor reach every member', () => {
    // Act and assert
    expect(isMemberInReach({ allStores: true, storeIds: [] }, [S2], false)).toBe(true);
    expect(isMemberInReach({ allStores: true, storeIds: [] }, [], true)).toBe(true);
  });

  it('lets an S1-only actor reach an S1-only member', () => {
    // Act and assert
    expect(isMemberInReach({ allStores: false, storeIds: [S1] }, [S1], false)).toBe(true);
  });

  it('keeps an S1-only actor away from a member who also lives on S2', () => {
    // Act and assert
    expect(isMemberInReach({ allStores: false, storeIds: [S1] }, [S1, S2], false)).toBe(false);
  });

  it('keeps a store-limited actor away from an all-store member', () => {
    // Act and assert
    expect(isMemberInReach({ allStores: false, storeIds: [S1, S2] }, [], true)).toBe(false);
  });

  it('keeps a store-limited actor away from a member with no stores (fails closed)', () => {
    // Act and assert
    expect(isMemberInReach({ allStores: false, storeIds: [S1] }, [], false)).toBe(false);
  });

  it('lets an all-store actor reach a member with no stores', () => {
    // Act and assert
    expect(isMemberInReach({ allStores: true, storeIds: [] }, [], false)).toBe(true);
  });
});
