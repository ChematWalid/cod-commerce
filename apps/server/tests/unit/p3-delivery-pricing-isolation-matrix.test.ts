import { DeliveryPricingPlugin } from '@cod/plugin-delivery-pricing';
import { getMetadataArgsStorage } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { P3_ISOLATION_CASES } from '../isolation/cases';
import { ANY_CARRIER_ID, STORE_REFERENCE_NOT_FOUND } from '../isolation/cases/delivery-pricing';
import { DELIVERY_PRICING_OPERATIONS, DELIVERY_PRICING_ROUTES } from '../isolation/delivery-pricing-operations';
import {
  DELIVERY_PRICING_WORLDS,
  deliveryPricingFingerprints,
  type DeliveryPricingWorld,
} from '../isolation/delivery-pricing-rows';
import { fingerprintsOf } from '../isolation/run';
import { DELIVERY_PRICING_TABLE_COUNTS, P2_TENANT_TABLES, P3_TENANT_TABLES } from '../isolation/tenant-tables';
import type { World } from '../isolation/world-types';
import { businessOf } from './p2-isolation-fixtures';

type Class = abstract new (...args: never[]) => object;
type Handler = (...args: never[]) => unknown;

const ROOT_TYPES = new Set(['Query', 'Mutation']);
const REQUEST_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

const handlersOf = (type: Class): Handler[] =>
  Object.getOwnPropertyNames(type.prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => (type.prototype as Record<string, Handler>)[name] as Handler);

/** Every Admin API operation the resolvers of `plugin` declare (Nest's GraphQL metadata). */
function declaredOperations(plugin: Class): string[] {
  const extension = Reflect.getMetadata('adminApiExtensions', plugin) as { resolvers: Class[] };
  return extension.resolvers.flatMap((resolver) =>
    handlersOf(resolver).flatMap((handler) => {
      const type = Reflect.getMetadata('graphql:resolver_type', handler) as string | undefined;
      if (type === undefined || !ROOT_TYPES.has(type)) return [];
      return [(Reflect.getMetadata('graphql:resolver_name', handler) as string | undefined) ?? handler.name];
    }),
  );
}

/** Every REST route the controllers of `plugin` declare, as `METHOD /path`. */
function declaredRoutes(plugin: Class): string[] {
  const controllers = Reflect.getMetadata('controllers', plugin) as Class[];
  return controllers.flatMap((controller) => {
    const base = Reflect.getMetadata('path', controller) as string;
    return handlersOf(controller).flatMap((handler) => {
      const path = Reflect.getMetadata('path', handler) as string | undefined;
      if (path === undefined) return [];
      const method = REQUEST_METHODS[Reflect.getMetadata('method', handler) as number] ?? 'UNKNOWN';
      return [`${method} ${`/${base}/${path}`.replaceAll(/\/+/g, '/').replace(/(.)\/$/, '$1')}`];
    });
  });
}

/** The tables of the entities `plugin` registers (Vendure's `entities` plugin metadata). */
function tablesOf(plugin: Class): string[] {
  const entities = Reflect.getMetadata('entities', plugin) as Class[];
  const tables = getMetadataArgsStorage().tables;
  return entities.map((entity) => tables.find((table) => table.target === entity)?.name ?? entity.name);
}

/** The delivery-pricing rows of a business of the matrix, with made-up ids. */
function deliveryPricingOf(label: 'A' | 'B'): DeliveryPricingWorld {
  const n = label === 'A' ? '1' : '2';
  const id = (prefix: string): string => `${prefix}1000000000000000${n}`;
  return {
    groupId: id('7'),
    groupName: `Pricing ${label}`,
    spareGroupId: id('8'),
    spareGroupName: `Spare group ${label}`,
    platformDefaultId: id('9'),
    otherStoreGroupId: id('6'),
    homePrice: label === 'A' ? 611 : 622,
    communeHomePrice: label === 'A' ? 661 : 672,
    pricingRole: { id: id('5'), name: `Pricing role ${label}` },
  };
}

describe('P3 delivery-pricing isolation matrix', () => {
  const world: World = { a: businessOf('A'), b: businessOf('B'), superadmin: { label: 'superadmin', token: 's' } };

  beforeAll(() => {
    for (const label of ['A', 'B'] as const) DELIVERY_PRICING_WORLDS.set(label, deliveryPricingOf(label));
  });

  afterAll(() => {
    DELIVERY_PRICING_WORLDS.clear();
  });

  it('counts every table the delivery-pricing plugin registers in the P3 census', () => {
    // Act
    const counted = Object.keys(DELIVERY_PRICING_TABLE_COUNTS);

    // Assert
    expect([...counted].sort()).toEqual(tablesOf(DeliveryPricingPlugin).sort());
    expect(P3_TENANT_TABLES).toEqual(expect.arrayContaining(counted));
  });

  it('keeps the delivery-pricing tables out of the P2 census, whose world seeds no commune rate', () => {
    // Act
    const inP2 = P2_TENANT_TABLES.filter((table) => P3_TENANT_TABLES.includes(table));

    // Assert
    expect(inP2).toEqual([]);
  });

  it('names every Admin API operation and REST route the delivery-pricing plugin declares', () => {
    // Act
    const named = {
      operations: DELIVERY_PRICING_OPERATIONS.map((operation) => operation.name).sort(),
      routes: DELIVERY_PRICING_ROUTES.map((route) => `${route.method} ${route.route}`).sort(),
    };

    // Assert
    expect(named).toEqual({
      operations: declaredOperations(DeliveryPricingPlugin).sort(),
      routes: declaredRoutes(DeliveryPricingPlugin).sort(),
    });
  });

  it('gives every route and operation of the delivery-pricing plugin a cell', () => {
    // Arrange
    const declared = [...declaredOperations(DeliveryPricingPlugin), ...declaredRoutes(DeliveryPricingPlugin)];

    // Act
    const covered = new Set(P3_ISOLATION_CASES.map((testCase) => testCase.endpoint));

    // Assert
    expect(declared.filter((endpoint) => !covered.has(endpoint))).toEqual([]);
  });

  it.each([
    ['deliveryPricing.deliveryFeeGroups.own', '/admin-api'],
    ['deliveryPricing.get-/delivery-fees.own', '/delivery-fees'],
  ])("lists A's own first-store groups only in %s", (id, path) => {
    // Arrange
    const cell = P3_ISOLATION_CASES.find((testCase) => testCase.id === id);

    // Act
    const request = cell?.request(world.a, world.b, world);

    // Assert
    expect(request?.path).toBe(path);
    expect(request?.channel?.token).toBe(world.a.stores[0].channelToken);
    const own = deliveryPricingOf('A');
    expect(cell?.expect.kind === 'own' ? cell.expect.mustInclude(world.a) : []).toEqual([
      own.groupId,
      own.spareGroupId,
      own.platformDefaultId,
    ]);
    expect(cell?.expect.kind === 'own' ? cell.expect.mustExclude?.(world.a) : []).toEqual([own.otherStoreGroupId]);
  });

  it.each([
    ['tenancy.updateStore.foreign-fee-group', deliveryPricingOf('B').groupId, 0],
    ['tenancy.updateStore.other-store-fee-group', deliveryPricingOf('A').groupId, 1],
  ] as const)('refuses %s with the pinned reference code (D3111)', (id, groupId, storeIndex) => {
    // Arrange
    const cell = P3_ISOLATION_CASES.find((testCase) => testCase.id === id);

    // Act
    const request = cell?.request(world.a, world.b, world);

    // Assert
    expect(cell?.expect).toEqual({ kind: 'code', code: STORE_REFERENCE_NOT_FOUND });
    expect(request?.body).toMatchObject({
      variables: { id: world.a.stores[storeIndex].id, input: { defaultDeliveryFeeGroupId: groupId } },
    });
    expect(request?.channel?.token).toBe(world.a.stores[storeIndex].channelToken);
  });

  it('refuses any carrier id on updateStore until P5.S1 (D3109)', () => {
    // Arrange
    const cell = P3_ISOLATION_CASES.find((testCase) => testCase.id === 'tenancy.updateStore.carrier');

    // Act
    const request = cell?.request(world.a, world.b, world);

    // Assert
    expect(cell?.expect).toEqual({ kind: 'code', code: STORE_REFERENCE_NOT_FOUND });
    expect(request?.body).toMatchObject({ variables: { input: { defaultCarrierId: ANY_CARRIER_ID } } });
  });

  it("scans every answer for the victim's delivery-pricing ids and names", () => {
    // Act
    const scanned = fingerprintsOf(world.b);

    // Assert
    expect(scanned).toEqual(expect.arrayContaining(deliveryPricingFingerprints(deliveryPricingOf('B'))));
  });

  it('gives every cell a unique id', () => {
    // Arrange
    const ids = P3_ISOLATION_CASES.map((testCase) => testCase.id);

    // Act
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

    // Assert
    expect(duplicates).toEqual([]);
  });

  it.each(P3_ISOLATION_CASES.map((testCase) => [testCase.id, testCase] as const))(
    'builds %s in both directions from a seeded world',
    (_id, testCase) => {
      // Arrange
      const directions = [
        [world.a, world.b],
        [world.b, world.a],
      ] as const;

      // Act
      const requests = directions.map(([attacker, victim]) => testCase.request(attacker, victim, world));

      // Assert
      for (const request of requests) {
        expect(['/admin-api', '/delivery-fees'].some((prefix) => request.path.startsWith(prefix))).toBe(true);
        expect(JSON.stringify(request)).not.toContain('undefined');
      }
    },
  );
});
