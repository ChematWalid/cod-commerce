import { describe, expect, it } from 'vitest';
import { withoutArchivedStores } from '../../dashboard/archived-store-ids';

describe('withoutArchivedStores', () => {
  it('drops archived ids from store lists at any depth', () => {
    const diff = { before: { storeIds: ['1', '2'] }, after: { storeIds: ['2'] } };

    expect(withoutArchivedStores(diff, new Set(['2']))).toEqual({
      before: { storeIds: ['1'] },
      after: { storeIds: [] },
    });
  });

  it('leaves every other field alone, even one equal to an archived id', () => {
    const diff = { added: ['2'], roleId: '2' };

    expect(withoutArchivedStores(diff, new Set(['2']))).toEqual(diff);
  });

  it('returns a non-object unchanged', () => {
    expect(withoutArchivedStores('text', new Set(['2']))).toBe('text');
  });
});
