import { CatalogPlugin } from '@cod/plugin-catalog';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { P2_ISOLATION_CASES } from '../isolation/cases';
import { CATALOG_OPERATIONS, CATALOG_ROUTES } from '../isolation/catalog-operations';
import { CATALOG_WORLDS, type CatalogWorld } from '../isolation/catalog-world';
import { TEAM_WORLDS } from '../isolation/team-world';
import type { BusinessWorld, World } from '../isolation/world-types';

type Class = abstract new (...args: never[]) => object;
type Handler = (...args: never[]) => unknown;

const ROOT_TYPES = new Set(['Query', 'Mutation']);
const REQUEST_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

const handlersOf = (type: Class): Handler[] =>
  Object.getOwnPropertyNames(type.prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => (type.prototype as Record<string, Handler>)[name] as Handler);

/** Every Admin API operation the catalog's resolvers declare (Nest's GraphQL metadata). */
function declaredOperations(): string[] {
  const extension = Reflect.getMetadata('adminApiExtensions', CatalogPlugin) as { resolvers: Class[] };
  return extension.resolvers.flatMap((resolver) =>
    handlersOf(resolver).flatMap((handler) => {
      const type = Reflect.getMetadata('graphql:resolver_type', handler) as string | undefined;
      if (type === undefined || !ROOT_TYPES.has(type)) return [];
      return [(Reflect.getMetadata('graphql:resolver_name', handler) as string | undefined) ?? handler.name];
    }),
  );
}

/** Every REST route the catalog's controllers declare, as `METHOD /path`. */
function declaredRoutes(): string[] {
  const controllers = Reflect.getMetadata('controllers', CatalogPlugin) as Class[];
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

describe('P2 isolation matrix', () => {
  const world: World = { a: businessOf('A'), b: businessOf('B'), superadmin: { label: 'superadmin', token: 's' } };

  beforeAll(() => {
    for (const label of ['A', 'B'] as const) {
      CATALOG_WORLDS.set(label, catalogOf(label));
      TEAM_WORLDS.set(label, {
        ownerMemberId: `14000000000000000${label === 'A' ? '1' : '2'}`,
        invited: { memberId: '15', email: 'i@example.test' },
        commission: { id: '16', name: 'Commission' },
      });
    }
  });

  afterAll(() => {
    CATALOG_WORLDS.clear();
    TEAM_WORLDS.clear();
  });

  it('names every Admin API operation the catalog plugin declares', () => {
    // Arrange
    const declared = declaredOperations();

    // Act
    const covered = CATALOG_OPERATIONS.map((operation) => operation.name);

    // Assert
    expect([...covered].sort()).toEqual([...declared].sort());
  });

  it('names every REST route the catalog plugin declares', () => {
    // Arrange
    const declared = declaredRoutes();

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
