import { CatalogPlugin } from '@cod/plugin-catalog';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { describe, expect, it } from 'vitest';
import { OffersPlugin } from '../../index';

/** Nest's module metadata key for `imports`, and Vendure's key for the compatibility range. */
const IMPORTS_KEY = 'imports';
const COMPATIBILITY_KEY = 'compatibility';

describe('OffersPlugin', () => {
  it('declares compatibility ^3.8.0 and imports tenancy and catalog', () => {
    // Arrange
    const plugin = OffersPlugin;

    // Act
    const imports = Reflect.getMetadata(IMPORTS_KEY, plugin) as readonly unknown[];
    const compatibility: unknown = Reflect.getMetadata(COMPATIBILITY_KEY, plugin);

    // Assert
    expect(imports).toEqual(expect.arrayContaining([TenancyPlugin, CatalogPlugin]));
    expect(compatibility).toBe('^3.8.0');
  });
});
