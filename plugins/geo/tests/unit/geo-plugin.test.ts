import { describe, expect, it } from 'vitest';
import { GeoPlugin, TOWN_AVAILABILITY_REGISTRAR } from '../../index';

/** Nest's module metadata key for `exports`, and Vendure's key for the compatibility range. */
const EXPORTS_KEY = 'exports';
const COMPATIBILITY_KEY = 'compatibility';

describe('GeoPlugin', () => {
  it('declares compatibility ^3.8.0', () => {
    // Act
    const compatibility: unknown = Reflect.getMetadata(COMPATIBILITY_KEY, GeoPlugin);

    // Assert
    expect(compatibility).toBe('^3.8.0');
  });

  it('exports the town availability registrar delivery pricing registers on', () => {
    // Act
    const exported = Reflect.getMetadata(EXPORTS_KEY, GeoPlugin) as readonly unknown[];

    // Assert
    expect(exported).toContain(TOWN_AVAILABILITY_REGISTRAR);
  });
});
