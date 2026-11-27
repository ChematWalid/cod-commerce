import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { beforeAll, describe, expect, it } from 'vitest';
import { deliveryPricingSuite } from './delivery-pricing-kit';
import { OPERATION_REGISTRY, ROUTE_REGISTRY, type TargetIds } from './endpoint-registry';
import { callOperation, callRoute } from './registry-calls';

const suite = deliveryPricingSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const FORBIDDEN = 'FORBIDDEN';
const FORBIDDEN_STATUS = 403;
const PRICING_KEYS = [
  'delivery.pricing.view',
  'delivery.pricing.create',
  'delivery.pricing.edit',
  'delivery.pricing.delete',
] as const;

/** Every pricing key but the one a handler requires, plus the carriers keys: a role that can do everything else. */
const allKeysBut = (access: string) => [
  ...PRICING_KEYS.filter((key) => key !== access),
  'delivery.carriers.view' as const,
  'delivery.carriers.edit' as const,
];

describe('fee-group handlers refuse a role that lacks their key', () => {
  let ids: TargetIds;

  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await suite.kit.createGroup('Guarded');
    const spare = await suite.kit.createGroup('Spare');
    ids = { groupId: group.id, spareGroupId: spare.id };
  });

  it.each(OPERATION_REGISTRY)('$operation is FORBIDDEN for a member with no role', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, []);

    // Act
    const outcome = await callOperation(suite.kit, entry, ids);

    // Assert
    expect(outcome.codes).toEqual([FORBIDDEN]);
  });

  it.each(OPERATION_REGISTRY)('$operation is FORBIDDEN for a role holding every other delivery key', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, allKeysBut(entry.access));

    // Act
    const outcome = await callOperation(suite.kit, entry, ids);

    // Assert
    expect(outcome.codes).toEqual([FORBIDDEN]);
  });

  it.each(ROUTE_REGISTRY)('$method $route answers 403 for a member with no role', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, []);

    // Act
    const answer = await callRoute(suite.kit, entry, ids);

    // Assert
    expect(answer.status).toBe(FORBIDDEN_STATUS);
  });

  it.each(ROUTE_REGISTRY)('$method $route answers 403 for a role holding every other delivery key', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, allKeysBut(entry.access));

    // Act
    const answer = await callRoute(suite.kit, entry, ids);

    // Assert
    expect(answer.status).toBe(FORBIDDEN_STATUS);
  });

  it.each(OPERATION_REGISTRY)(
    '$operation succeeds for a member holding only its key (positive control)',
    async (entry) => {
      // Arrange
      await suite.kit.signInAsMember(suite.fixtures.a, [entry.access]);

      // Act
      const outcome = await callOperation(suite.kit, entry, ids);

      // Assert
      expect(outcome.codes).toEqual([]);
      expect(outcome.data).not.toBeNull();
    },
  );
});
