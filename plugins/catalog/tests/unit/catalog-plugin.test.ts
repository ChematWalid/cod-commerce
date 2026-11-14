import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { describe, expect, it } from 'vitest';
import { CatalogPlugin } from '../../index';

/** Nest's module metadata key for `imports`, and Vendure's keys for the dashboard entry and the compatibility. */
const IMPORTS_KEY = 'imports';
const DASHBOARD_KEY = 'dashboard';
const COMPATIBILITY_KEY = 'compatibility';

describe('CatalogPlugin', () => {
  it('imports tenancy and the outbox, which its guards and writes rely on', () => {
    // Arrange
    const plugin = CatalogPlugin;

    // Act
    const imports = Reflect.getMetadata(IMPORTS_KEY, plugin) as readonly unknown[];

    // Assert
    expect(imports).toEqual(expect.arrayContaining([TenancyPlugin, PlatformOutboxPlugin]));
  });

  it('declares its dashboard entry and the Vendure 3.8 compatibility range', () => {
    // Arrange
    const plugin = CatalogPlugin;

    // Act
    const dashboard: unknown = Reflect.getMetadata(DASHBOARD_KEY, plugin);
    const compatibility: unknown = Reflect.getMetadata(COMPATIBILITY_KEY, plugin);

    // Assert
    expect(dashboard).toBe('./dashboard/index.tsx');
    expect(compatibility).toBe('^3.8.0');
  });
});
