import { CatalogPlugin } from '@cod/plugin-catalog';
import { CatalogImportPlugin } from '@cod/plugin-catalog-import';
import { CatalogPacksPlugin } from '@cod/plugin-catalog-packs';
import { CollectionsRulesPlugin } from '@cod/plugin-collections-rules';
import { OffersPlugin } from '@cod/plugin-offers';
import { getMetadataArgsStorage } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { P2_ISOLATION_CASES } from '../isolation/cases';
import { OFFERS_SWEEP_CASES } from '../isolation/cases/offers-sweep';
import { CATALOG_OPERATIONS, CATALOG_ROUTES } from '../isolation/catalog-operations';
import { CATALOG_IMPORT_WORLDS } from '../isolation/catalog-import-world';
import { CATALOG_WORLDS } from '../isolation/catalog-world';
import { COLLECTION_OPERATIONS, COLLECTION_ROUTES } from '../isolation/collections-operations';
import { COLLECTION_WORLDS } from '../isolation/collections-world';
import { IMPORT_OPERATIONS, IMPORT_ROUTES } from '../isolation/import-operations';
import { OFFERS_OPERATIONS, OFFERS_ROUTES, ownOfferIdsOf } from '../isolation/offers-operations';
import { OFFERS_WORLDS } from '../isolation/offers-rows';
import { PACKS_OPERATIONS, PACKS_ROUTES } from '../isolation/packs-operations';
import { TEAM_WORLDS } from '../isolation/team-world';
import {
  CATALOG_IMPORT_TABLE_COUNTS,
  CATALOG_PACKS_TABLE_COUNTS,
  CATALOG_TABLE_COUNTS,
  COLLECTIONS_TABLE_COUNTS,
  OFFERS_TABLE_COUNTS,
} from '../isolation/tenant-tables';
import type { World } from '../isolation/world-types';
import { businessOf, catalogImportOf, catalogOf, collectionsOf, offersOf } from './p2-isolation-fixtures';

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

describe('P2 isolation matrix', () => {
  const world: World = { a: businessOf('A'), b: businessOf('B'), superadmin: { label: 'superadmin', token: 's' } };

  beforeAll(() => {
    for (const label of ['A', 'B'] as const) {
      CATALOG_WORLDS.set(label, catalogOf(label));
      COLLECTION_WORLDS.set(label, collectionsOf(label));
      OFFERS_WORLDS.set(label, offersOf(label));
      CATALOG_IMPORT_WORLDS.set(label, catalogImportOf(label));
      TEAM_WORLDS.set(label, {
        ownerMemberId: `14000000000000000${label === 'A' ? '1' : '2'}`,
        invited: { memberId: '15', email: 'i@example.test' },
        commission: { id: '16', name: 'Commission' },
      });
    }
  });

  afterAll(() => {
    CATALOG_WORLDS.clear();
    COLLECTION_WORLDS.clear();
    OFFERS_WORLDS.clear();
    CATALOG_IMPORT_WORLDS.clear();
    TEAM_WORLDS.clear();
  });

  it('counts every table the catalog plugin registers in the P2 census', () => {
    // Act
    const counted = Object.keys(CATALOG_TABLE_COUNTS);

    // Assert
    expect([...counted].sort()).toEqual(tablesOf(CatalogPlugin).sort());
  });

  it('counts every table the offers plugin registers in the P2 census', () => {
    // Act
    const counted = Object.keys(OFFERS_TABLE_COUNTS);

    // Assert
    expect([...counted].sort()).toEqual(tablesOf(OffersPlugin).sort());
  });

  it('covers every CollectionsRulesPlugin operation, route and table', () => {
    // Arrange
    const declared = {
      operations: [...declaredOperations(CollectionsRulesPlugin)].sort(),
      routes: [...declaredRoutes(CollectionsRulesPlugin)].sort(),
      tables: tablesOf(CollectionsRulesPlugin).sort(),
    };

    // Act
    const covered = {
      operations: COLLECTION_OPERATIONS.map((operation) => operation.name).sort(),
      routes: COLLECTION_ROUTES.map((route) => `${route.method} ${route.route}`).sort(),
      tables: Object.keys(COLLECTIONS_TABLE_COUNTS).sort(),
    };

    // Assert
    expect(covered).toEqual(declared);
  });

  it.each([
    ['catalog-packs', CatalogPacksPlugin, CATALOG_PACKS_TABLE_COUNTS],
    ['catalog-import', CatalogImportPlugin, CATALOG_IMPORT_TABLE_COUNTS],
  ] as const)('counts every new table the %s plugin registers in the P2 census', (_name, plugin, census) => {
    // Act
    const counted = Object.keys(census);

    // Assert
    expect([...counted].sort()).toEqual(tablesOf(plugin).sort());
  });

  it.each([
    ['CatalogPacksPlugin', CatalogPacksPlugin, PACKS_OPERATIONS, PACKS_ROUTES],
    ['CatalogImportPlugin', CatalogImportPlugin, IMPORT_OPERATIONS, IMPORT_ROUTES],
  ] as const)('names every Admin API operation and REST route %s declares', (_name, plugin, operations, routes) => {
    // Act
    const named = {
      operations: operations.map((operation) => operation.name).sort(),
      routes: routes.map((route) => `${route.method} ${route.route}`).sort(),
    };

    // Assert
    expect(named).toEqual({ operations: declaredOperations(plugin).sort(), routes: declaredRoutes(plugin).sort() });
  });

  it.each([
    ['CatalogPacksPlugin', CatalogPacksPlugin],
    ['CatalogImportPlugin', CatalogImportPlugin],
  ] as const)('gives every route and operation of %s a cell', (_name, plugin) => {
    // Arrange
    const declared = [...declaredOperations(plugin), ...declaredRoutes(plugin)];

    // Act
    const covered = new Set(P2_ISOLATION_CASES.map((testCase) => testCase.endpoint));

    // Assert
    expect(declared.filter((endpoint) => !covered.has(endpoint))).toEqual([]);
  });

  it('names every Admin API operation the catalog plugin declares', () => {
    // Arrange
    const declared = declaredOperations(CatalogPlugin);

    // Act
    const covered = CATALOG_OPERATIONS.map((operation) => operation.name);

    // Assert
    expect([...covered].sort()).toEqual([...declared].sort());
  });

  it('names every REST route the catalog plugin declares', () => {
    // Arrange
    const declared = declaredRoutes(CatalogPlugin);

    // Act
    const covered = CATALOG_ROUTES.map((route) => `${route.method} ${route.route}`);

    // Assert
    expect([...covered].sort()).toEqual([...declared].sort());
  });

  it('names every Admin API operation the offers plugin declares', () => {
    // Arrange
    const declared = declaredOperations(OffersPlugin);

    // Act
    const covered = OFFERS_OPERATIONS.map((operation) => operation.name);

    // Assert
    expect([...covered].sort()).toEqual([...declared].sort());
  });

  it('names every REST route the offers plugin declares', () => {
    // Arrange
    const declared = declaredRoutes(OffersPlugin);

    // Act
    const covered = OFFERS_ROUTES.map((route) => `${route.method} ${route.route}`);

    // Assert
    expect([...covered].sort()).toEqual([...declared].sort());
  });

  it("lists A's offers as A's store-restricted member on its first store (the member-other-store control)", () => {
    // Arrange
    const control = OFFERS_SWEEP_CASES.find((testCase) => testCase.id === 'offers.offers.member-own-store');

    // Act
    const request = control?.request(world.a, world.b, world);

    // Assert
    expect(request?.caller).toBe(world.a.member);
    expect(request?.channel?.token).toBe(world.a.stores[0].channelToken);
    expect(control?.expect.kind === 'own' ? control.expect.mustInclude(world.a) : []).toEqual(ownOfferIdsOf(world.a));
  });

  it.each([
    ['offers.offer', 'offers.get-/offers/:id'],
    ['offers.offerAppTypes', 'offers.get-/offers/app-types'],
    ['offers.previewOffer', 'offers.post-/offers/preview'],
    ['offers.deleteOffer', 'offers.delete-/offers/:id'],
  ])('puts %s and %s in the same access column', (operation, route) => {
    // Arrange
    const accessOf = (id: string) => OFFERS_SWEEP_CASES.find((testCase) => testCase.id === `${id}.foreign-id`)?.access;

    // Act
    const [onGraphql, onRest] = [accessOf(operation), accessOf(route)];

    // Assert
    expect(onGraphql).toBeDefined();
    expect(onRest).toBe(onGraphql);
  });

  it.each([
    ['offers.createOffer.foreign-id', { kind: 'code', code: 'offers.unknown-targets' }],
    ['offers.post-/offers.foreign-id', { kind: 'status', status: 422, code: 'offers.unknown-targets' }],
  ])("refuses %s naming the other business's variant (D2537)", (id, expected) => {
    // Act
    const cell = OFFERS_SWEEP_CASES.find((testCase) => testCase.id === id);

    // Assert
    expect(cell?.expect).toEqual(expected);
    expect(cell?.access).toBe('write');
  });

  it('gives every cell a unique id', () => {
    // Arrange
    const ids = P2_ISOLATION_CASES.map((testCase) => testCase.id);

    // Act
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

    // Assert
    expect(duplicates).toEqual([]);
  });

  it.each(P2_ISOLATION_CASES.map((testCase) => [testCase.id, testCase] as const))(
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
        expect(['/admin-api', '/catalog/', '/offers'].some((prefix) => request.path.startsWith(prefix))).toBe(true);
        expect(JSON.stringify(request)).not.toContain('undefined');
      }
    },
  );
});
