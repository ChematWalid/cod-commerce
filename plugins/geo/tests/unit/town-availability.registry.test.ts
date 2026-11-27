import { toStoreId } from '@cod/shared';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { SingleSourceRegistry } from '../../application/single-source.registry';
import { newTownAvailabilityRegistry } from '../../application/town-availability.registry';
import type {
  ModeAvailability,
  TownAvailability,
  TownAvailabilitySource,
} from '../../domain/ports/town-availability.port';

const store = toStoreId('7001');

const homeOnly: TownAvailabilitySource = {
  availabilityFor: () =>
    Promise.resolve({ home: true, desk: false, towns: new Map([[31001, { home: true, desk: true }]]) }),
};

describe('SingleSourceRegistry', () => {
  it('answers with the default until a source registers, then with that source', () => {
    // Arrange
    const registry = new SingleSourceRegistry('test source', 'default');

    // Act
    const before = registry.current();
    registry.register('registered');

    // Assert
    expect(before).toBe('default');
    expect(registry.current()).toBe('registered');
  });
});

describe('newTownAvailabilityRegistry', () => {
  it('narrows nothing by default: every wilaya answers null', async () => {
    // Arrange
    const registry = newTownAvailabilityRegistry();

    // Act
    const availability = await registry.current().availabilityFor(store, '16');

    // Assert
    expect(availability).toBeNull();
  });

  it('asks the registered source once one registers', async () => {
    // Arrange
    const registry = newTownAvailabilityRegistry();
    registry.register(homeOnly);

    // Act
    const availability = await registry.current().availabilityFor(store, '31');

    // Assert
    expect(availability).toEqual({ home: true, desk: false, towns: new Map([[31001, { home: true, desk: true }]]) });
  });

  it('refuses a second source: two would silently disagree', () => {
    // Arrange
    const registry = newTownAvailabilityRegistry();
    registry.register(homeOnly);

    // Act
    const again = () => {
      registry.register(homeOnly);
    };

    // Assert
    expect(again).toThrow(/town availability source/);
  });
});

describe('TownAvailability', () => {
  it('carries the per-commune results that differ from the wilaya, keyed by ONS code', () => {
    // Arrange
    const differing: ModeAvailability = { home: true, desk: true };

    // Act
    const availability: TownAvailability = { home: false, desk: false, towns: new Map([[16001, differing]]) };

    // Assert
    expectTypeOf<TownAvailability['towns']>().toEqualTypeOf<ReadonlyMap<number, ModeAvailability>>();
    expect(availability.towns.get(16001)).toBe(differing);
  });
});
