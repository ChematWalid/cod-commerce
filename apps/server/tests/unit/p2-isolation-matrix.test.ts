import { CatalogPlugin } from '@cod/plugin-catalog';
import { CatalogImportPlugin } from '@cod/plugin-catalog-import';
import { CatalogPacksPlugin } from '@cod/plugin-catalog-packs';
import { OffersPlugin } from '@cod/plugin-offers';
import { getMetadataArgsStorage } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { P2_ISOLATION_CASES } from '../isolation/cases';
import { CATALOG_OPERATIONS, CATALOG_ROUTES } from '../isolation/catalog-operations';
import { CATALOG_IMPORT_WORLDS, type CatalogImportWorld } from '../isolation/catalog-import-world';
import { CATALOG_WORLDS, type CatalogWorld } from '../isolation/catalog-world';
import { IMPORT_OPERATIONS, IMPORT_ROUTES } from '../isolation/import-operations';
import { PACKS_OPERATIONS, PACKS_ROUTES } from '../isolation/packs-operations';
import { TEAM_WORLDS } from '../isolation/team-world';
import {
  CATALOG_IMPORT_TABLE_COUNTS,
  CATALOG_PACKS_TABLE_COUNTS,
  CATALOG_TABLE_COUNTS,
  OFFERS_TABLE_COUNTS,
} from '../isolation/tenant-tables';
import type { BusinessWorld, World } from '../isolation/world-types';

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

const store = (label: string, id: string) => ({
  label,
  id,
  subdomain: `store-${id}`,
  channelToken: `token-${id}`,
});

/** A business of the matrix with made-up ids: requests are built, never sent. */
function businessOf(label: 'A' | 'B'): BusinessWorld {
  const n = label === 'A' ? '1' : '2';
  return {
    label,
    businessId: `10000000000000000${n}`,
    name: `Business ${label}`,
    stores: [store(`${label}1`, `20000000000000000${n}`), store(`${label}2`, `30000000000000000${n}`)],
    owner: { label: `owner ${label}`, token: 'owner', email: 'o@example.test', administratorId: n, lastName: 'L' },
    member: { label: `member ${label}`, token: 'member', email: 'm@example.test', administratorId: `1${n}` },
    role: { id: `40000000000000000${n}`, name: `Role ${label}` },
    secret: { id: `50000000000000000${n}`, value: 'synthetic' },
    note: { id: `60000000000000000${n}`, title: `Note ${label}` },
    logoAssetId: `T_${n}`,
  };
}

function catalogOf(label: 'A' | 'B'): CatalogWorld {
  const n = label === 'A' ? '1' : '2';
  const id = (prefix: string): string => `${prefix}0000000000000000${n}`;
  return {
    brand: { id: id('7'), name: `Brand ${label}` },
    tag: { id: id('8'), name: `Tag ${label}` },
    highlight: { id: id('9'), text: `Highlight ${label}` },
    collection: { id: `T_1${n}`, name: `Collection ${label}` },
    media: { id: id('11'), assetId: `T_2${n}` },
    otherStoreMedia: { id: id('12'), assetId: `T_3${n}` },
    product: {
      id: `T_4${n}`,
      restId: `4${n}`,
      title: `Product ${label}`,
      slug: `iso-${label}`,
      sku: `ISO-${label}`,
      variantIds: [`T_5${n}`, `T_6${n}`],
    },
    catalogRole: { id: id('13'), name: `Catalog role ${label}` },
  };
}

/** The packs, import and export rows of a business of the matrix, with made-up ids. */
function catalogImportOf(label: 'A' | 'B'): CatalogImportWorld {
  const n = label === 'A' ? '1' : '2';
  const id = (prefix: string): string => `${prefix}0000000000000000${n}`;
  return {
    pack: { productId: `T_7${n}`, componentIds: [`T_8${n}`, `T_9${n}`] },
    spreadsheet: { importId: id('17'), uploadKey: `uploads/b/${id('1')}/s/${id('2')}/imports/${id('17')}/source` },
    exportId: id('18'),
    link: { importId: id('19'), productId: `T_10${n}` },
  };
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
        expect(request.path === '/admin-api' || request.path.startsWith('/catalog/')).toBe(true);
        expect(JSON.stringify(request)).not.toContain('undefined');
      }
    },
  );
});
