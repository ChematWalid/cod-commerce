import { COLLECTION_MAX_MANUAL_PRODUCTS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  CollectionProductNotFoundError,
  InvalidCollectionInputError,
  TooManyManualProductsError,
} from '../../domain/errors';
import { appendManual, manualMembers, membershipDiff, ruleMembers } from '../../domain/membership';

describe('membership', () => {
  it('orders rule members newest product first, by numeric id', () => {
    // Arrange: '10' sorts before '9' as text, after it as a number; a duplicate counts once
    const matched = ['9', '10', '1200000000000000001', '2', '10'];

    // Act
    const members = ruleMembers(matched);

    // Assert
    expect(members).toEqual([
      { productId: '1200000000000000001', position: 0 },
      { productId: '10', position: 0 },
      { productId: '9', position: 0 },
      { productId: '2', position: 0 },
    ]);
  });

  it('gives a manual set the positions 0..n-1 in the given order', () => {
    // Arrange
    const productIds = ['7', '3', '9'];

    // Act
    const members = manualMembers(productIds);

    // Assert
    expect(members).toEqual([
      { productId: '7', position: 0 },
      { productId: '3', position: 1 },
      { productId: '9', position: 2 },
    ]);
  });

  it('refuses a manual set over the cap', () => {
    // Arrange
    const productIds = Array.from({ length: COLLECTION_MAX_MANUAL_PRODUCTS + 1 }, (_, index) => String(index + 1));

    // Act
    const act = () => manualMembers(productIds);

    // Assert
    expect(act).toThrow(TooManyManualProductsError);
  });

  it('appends a product last', () => {
    // Arrange
    const current = manualMembers(['7', '3']);

    // Act
    const members = appendManual(current, '9');

    // Assert
    expect(members).toEqual([...current, { productId: '9', position: 2 }]);
  });

  it('leaves the members as they are when the product is already one', () => {
    // Arrange
    const current = manualMembers(['7', '3']);

    // Act
    const members = appendManual(current, '7');

    // Assert
    expect(members).toEqual(current);
  });

  it('refuses to append the 501st product', () => {
    // Arrange
    const full = manualMembers(Array.from({ length: COLLECTION_MAX_MANUAL_PRODUCTS }, (_, index) => String(index + 1)));

    // Act
    const act = () => appendManual(full, '999999');

    // Assert
    expect(act).toThrow(TooManyManualProductsError);
  });

  it('finds nothing to change between equal sets', () => {
    // Arrange
    const members = manualMembers(['7', '3']);

    // Act
    const diff = membershipDiff(members, manualMembers(['7', '3']));

    // Assert
    expect(diff).toEqual({ insert: [], update: [], remove: [] });
  });

  it('lists the rows to insert, move and remove', () => {
    // Arrange
    const current = manualMembers(['7', '3', '5']);
    const next = manualMembers(['3', '7', '9']);

    // Act
    const diff = membershipDiff(current, next);

    // Assert
    expect(diff).toEqual({
      insert: [{ productId: '9', position: 2 }],
      update: [
        { productId: '3', position: 0 },
        { productId: '7', position: 1 },
      ],
      remove: ['5'],
    });
  });

  it('refuses a manual set that names a product twice', () => {
    // Arrange: '05' and '5' are one product
    const productIds = ['5', '7', '05'];

    // Act
    const act = () => manualMembers(productIds);

    // Assert
    expect(act).toThrow(InvalidCollectionInputError);
  });

  it('writes manual members with canonical ids', () => {
    // Arrange
    const productIds = ['007', '3'];

    // Act
    const members = manualMembers(productIds);

    // Assert
    expect(members).toEqual([
      { productId: '7', position: 0 },
      { productId: '3', position: 1 },
    ]);
  });

  it('does not append again a member named with a non-canonical id', () => {
    // Arrange
    const current = manualMembers(['7', '3']);

    // Act
    const members = appendManual(current, '07');

    // Assert
    expect(members).toEqual(current);
  });

  it('a non-canonical id of a current member neither duplicates nor removes it', () => {
    // Arrange
    const current = [
      { productId: '7', position: 0 },
      { productId: '3', position: 1 },
    ];
    const next = [
      { productId: '07', position: 0 },
      { productId: '3', position: 1 },
    ];

    // Act
    const diff = membershipDiff(current, next);

    // Assert
    expect(diff).toEqual({ insert: [], update: [], remove: [] });
  });

  it('refuses a next membership that holds a product twice', () => {
    // Arrange
    const next = [
      { productId: '5', position: 0 },
      { productId: '5', position: 1 },
    ];

    // Act
    const act = () => membershipDiff([], next);

    // Assert
    expect(act).toThrow(InvalidCollectionInputError);
  });

  it('ruleMembers refuses a malformed product id with a typed error', () => {
    // Arrange
    const matched = ['3', 'x9', ''];

    // Act
    const act = () => ruleMembers(matched);

    // Assert
    expect(act).toThrow(CollectionProductNotFoundError);
  });

  it('refuses a malformed product id in a manual set or an append', () => {
    // Arrange
    const malformed = '-4';

    // Act
    const inSet = () => manualMembers(['3', malformed]);
    const appended = () => appendManual([], malformed);

    // Assert
    expect(inSet).toThrow(CollectionProductNotFoundError);
    expect(appended).toThrow(CollectionProductNotFoundError);
  });
});
