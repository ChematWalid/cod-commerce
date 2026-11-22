import { describe, expect, it } from 'vitest';
import {
  GeoPlugin,
  GeoProvinceEntity,
  GeoSeedService,
  GeoTownEntity,
  TOWN_AVAILABILITY_REGISTRAR,
  TOWN_DIRECTORY,
  type TownDirectory,
} from '../../index';

/** Nest's module metadata key for `exports`, and Vendure's key for the compatibility range. */
const EXPORTS_KEY = 'exports';
const COMPATIBILITY_KEY = 'compatibility';
const ENTITIES_KEY = 'entities';

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

  it('publishes the town directory port delivery pricing validates communes with', () => {
    // Arrange
    const directory: TownDirectory = { townsOf: () => Promise.resolve([16001, 16002]) };

    // Act
    const description = TOWN_DIRECTORY.description;

    // Assert
    expect(typeof TOWN_DIRECTORY).toBe('symbol');
    expect(description).toBe('GeoTownDirectory');
    expect(directory.townsOf('16')).toBeInstanceOf(Promise);
  });

  it('declares the global province and town tables', () => {
    // Act
    const entities = Reflect.getMetadata(ENTITIES_KEY, GeoPlugin) as readonly unknown[];

    // Assert
    expect(entities).toEqual([GeoProvinceEntity, GeoTownEntity]);
  });

  it('exports the seed service the migrate role converges', () => {
    // Act
    const exported = Reflect.getMetadata(EXPORTS_KEY, GeoPlugin) as readonly unknown[];

    // Assert
    expect(exported).toContain(GeoSeedService);
  });
});
