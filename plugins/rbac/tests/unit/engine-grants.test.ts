import { vendurePermissionName } from '@cod/shared';
import { Permission } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import {
  ENGINE_GRANTS,
  enginePermissionsFor,
  REVIEWED_STOCK_ENGINE_GRANTS,
  unreviewedStockGrants,
} from '../../domain/engine-grants';

const STOCK_PERMISSIONS: readonly string[] = Object.values(Permission);

describe('ENGINE_GRANTS', () => {
  it('holds no stock Vendure permission that has not been reviewed', () => {
    // Act
    const unreviewed = unreviewedStockGrants(ENGINE_GRANTS, STOCK_PERMISSIONS, REVIEWED_STOCK_ENGINE_GRANTS);

    // Assert
    expect(unreviewed).toEqual([]);
  });

  it('has no reviewed stock grant yet', () => {
    expect(REVIEWED_STOCK_ENGINE_GRANTS).toEqual([]);
  });

  it('fails the check when a stock permission is added to a copy of the map', () => {
    // Arrange
    const widened = { ...ENGINE_GRANTS, 'orders.cancel': ['UpdateAdministrator'] };

    // Act
    const unreviewed = unreviewedStockGrants(widened, STOCK_PERMISSIONS, REVIEWED_STOCK_ENGINE_GRANTS);

    // Assert
    expect(unreviewed).toEqual(['UpdateAdministrator']);
  });

  it('accepts a stock permission that is on the reviewed list', () => {
    // Arrange
    const widened = { ...ENGINE_GRANTS, 'orders.cancel': ['ReadCatalog'] };

    // Act
    const unreviewed = unreviewedStockGrants(widened, STOCK_PERMISSIONS, ['ReadCatalog']);

    // Assert
    expect(unreviewed).toEqual([]);
  });
});

describe('enginePermissionsFor', () => {
  it('gives the Vendure name of a key with no engine grant', () => {
    expect(enginePermissionsFor(['orders.cancel'])).toEqual([vendurePermissionName('orders.cancel')]);
  });

  it.each([
    ['store.stores.view', 'ReadTenantStore'],
    ['store.stores.create', 'CreateTenantStore'],
    ['store.settings.edit', 'UpdateTenantStore'],
    ['settings.business.view', 'ReadTenantBusiness'],
    ['settings.business.edit', 'UpdateTenantBusiness'],
  ] as const)('adds the engine grant of %s', (key, grant) => {
    expect(enginePermissionsFor([key])).toEqual([vendurePermissionName(key), grant]);
  });

  it('lists a shared name once', () => {
    expect(enginePermissionsFor(['orders.cancel', 'orders.cancel'])).toEqual([vendurePermissionName('orders.cancel')]);
  });

  it('never adds the stock Authenticated permission itself', () => {
    expect(enginePermissionsFor(['store.stores.view'])).not.toContain(Permission.Authenticated);
  });
});
