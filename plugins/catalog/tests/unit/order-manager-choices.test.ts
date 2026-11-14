import { describe, expect, it } from 'vitest';
import type { CatalogOrderManagerDto } from '../../dashboard/dto';
import { orderManagerChoices } from '../../dashboard/model/order-manager-choices';

const STORE_A = 'store-a';
const STORE_B = 'store-b';

const member = (
  id: string,
  storeAccess: CatalogOrderManagerDto['storeAccess'],
  storeIds: readonly string[] = [],
): CatalogOrderManagerDto => ({ id, name: `Member ${id}`, storeAccess, storeIds });

describe('order manager choices', () => {
  it('offers members of every store and members of this store only', () => {
    // Arrange
    const members = [member('1', 'all'), member('2', 'selected', [STORE_A]), member('3', 'selected', [STORE_B])];

    // Act
    const choices = orderManagerChoices(members, STORE_A, []);

    // Assert
    expect(choices.map(({ id }) => id)).toEqual(['1', '2']);
  });

  it('keeps an already chosen member of another store so the merchant can untick them', () => {
    // Arrange
    const members = [member('1', 'all'), member('3', 'selected', [STORE_B])];

    // Act
    const choices = orderManagerChoices(members, STORE_A, ['3']);

    // Assert
    expect(choices.map(({ id }) => id)).toEqual(['1', '3']);
  });
});
