import { describe, expect, it } from 'vitest';
import { PartitionRegistry } from '../../application/partition-registry';
import {
  InvalidPartitionPolicyError,
  PartitionRegistryClosedError,
  PartitionTableAlreadyRegisteredError,
} from '../../domain/errors';
import type { PartitionPolicy } from '../../domain/policy';

const policy = (overrides: Partial<PartitionPolicy> = {}): PartitionPolicy => ({
  table: 'probe',
  column: 'createdAt',
  interval: 'day',
  premake: 7,
  retain: 7,
  ...overrides,
});

describe('PartitionRegistry', () => {
  it('lists what was registered', () => {
    // Arrange
    const registry = new PartitionRegistry();

    // Act
    registry.register(policy());
    registry.register(policy({ table: 'other' }));

    // Assert
    expect(registry.policies().map((entry) => entry.table)).toEqual(['probe', 'other']);
  });

  it('refuses a second policy for one table', () => {
    // Arrange
    const registry = new PartitionRegistry();
    registry.register(policy());

    // Act / Assert
    expect(() => {
      registry.register(policy());
    }).toThrow(PartitionTableAlreadyRegisteredError);
  });

  it('refuses a registration after it is closed', () => {
    // Arrange
    const registry = new PartitionRegistry();
    registry.close();

    // Act / Assert
    expect(() => {
      registry.register(policy());
    }).toThrow(PartitionRegistryClosedError);
  });

  it.each([
    ['a table name that is not a plain identifier', { table: 'probe; DROP TABLE x' }],
    ['a column name that is not a plain identifier', { column: 'a"b' }],
    ['a table name too long for its partition names', { table: 'a'.repeat(60) }],
    ['a negative premake', { premake: -1 }],
    ['a fractional retain', { retain: 1.5 }],
    ['a scrub that is not after the interval count', { scrub: { afterIntervals: 0, sql: () => '' } }],
  ])('refuses %s', (_label, overrides) => {
    // Arrange
    const registry = new PartitionRegistry();

    // Act / Assert
    expect(() => {
      registry.register(policy(overrides));
    }).toThrow(InvalidPartitionPolicyError);
  });
});
