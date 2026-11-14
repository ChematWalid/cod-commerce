import { describe, expect, it } from 'vitest';
import { OrderManagersUnavailableError, OrderManagerUnknownError } from '../../domain/errors';
import { assertOrderManagers } from '../../domain/order-managers';

describe('assertOrderManagers', () => {
  it('accepts members the check knows', () => {
    // Act
    const check = (): void => {
      assertOrderManagers(['5', '7'], new Set(['5', '7', '9']));
    };

    // Assert
    expect(check).not.toThrow();
  });

  it('refuses a member the check does not know', () => {
    // Act
    const check = (): void => {
      assertOrderManagers(['5', '8'], new Set(['5']));
    };

    // Assert
    expect(check).toThrow(OrderManagerUnknownError);
  });

  it('refuses a non-empty list when no check is registered', () => {
    // Act
    const check = (): void => {
      assertOrderManagers(['5'], null);
    };

    // Assert
    expect(check).toThrow(OrderManagersUnavailableError);
  });

  it('accepts an empty list when no check is registered', () => {
    // Act
    const check = (): void => {
      assertOrderManagers([], null);
    };

    // Assert
    expect(check).not.toThrow();
  });
});
