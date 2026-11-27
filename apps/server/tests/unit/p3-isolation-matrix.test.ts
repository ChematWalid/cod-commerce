import { StorefrontApiPlugin } from '@cod/plugin-storefront-api';
import { INTERNAL_AUTH_HEADERS, parseInternalKeys, type InternalSigningKey } from '@cod/shared/internal-auth';
import { getMetadataArgsStorage } from 'typeorm';
import { describe, expect, it } from 'vitest';
import {
  STOREFRONT_ISOLATION_CASES,
  type StorefrontHoldings,
  type StorefrontIsolationCase,
} from '../isolation/cases/storefront-catalog';
import { runStorefrontMatrix, storefrontFailuresOf, storefrontHeadersOf } from '../isolation/storefront-run';
import { P2_TENANT_TABLES, P3_TENANT_TABLES, STOREFRONT_TABLE_COUNTS } from '../isolation/tenant-tables';

type Class = abstract new (...args: never[]) => object;

const REQUEST_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
const KEY = parseInternalKeys('k1:synthetic-p3-matrix-unit-secret-0000000000')[0] as InternalSigningKey;

/** Every REST route the controllers of `plugin` declare, as `METHOD /path`. */
function declaredRoutes(plugin: Class): string[] {
  const controllers = Reflect.getMetadata('controllers', plugin) as Class[];
  return controllers.flatMap((controller) => {
    const base = Reflect.getMetadata('path', controller) as string;
    return Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
      const handler = (controller.prototype as Record<string, unknown>)[name];
      const path = Reflect.getMetadata('path', handler as object) as string | undefined;
      if (name === 'constructor' || path === undefined) return [];
      const method = REQUEST_METHODS[Reflect.getMetadata('method', handler as object) as number] ?? 'UNKNOWN';
      return [`${method} /${base}/${path}`];
    });
  });
}

/** The tables of the entities `plugin` registers. */
function tablesOf(plugin: Class): string[] {
  const entities = Reflect.getMetadata('entities', plugin) as Class[];
  const tables = getMetadataArgsStorage().tables;
  return entities.map((entity) => tables.find((table) => table.target === entity)?.name ?? entity.name);
}

const holdingsOf = (label: 'A' | 'B'): StorefrontHoldings => ({
  storeId: label === 'A' ? '7100000000000000001' : '7200000000000000002',
  names: [`Product ${label}`],
  productSlug: `product-${label.toLowerCase()}`,
  productName: `Product ${label}`,
  searchTerm: `term${label}`,
  collectionSlug: `collection-${label.toLowerCase()}`,
});
const pair = { attacker: holdingsOf('A'), victim: holdingsOf('B') };

describe('P3 storefront isolation matrix', () => {
  it('covers every route the storefront API declares', () => {
    // Act
    const covered = new Set(STOREFRONT_ISOLATION_CASES.map((testCase) => testCase.endpoint));

    // Assert
    expect([...covered].sort()).toEqual(declaredRoutes(StorefrontApiPlugin).sort());
  });

  it('counts every table the storefront API registers in the P3 census, and leaves them out of P2', () => {
    // Act
    const counted = Object.keys(STOREFRONT_TABLE_COUNTS).sort();

    // Assert
    expect(counted).toEqual(tablesOf(StorefrontApiPlugin).sort());
    expect(P3_TENANT_TABLES).toEqual(expect.arrayContaining(counted));
    expect(P2_TENANT_TABLES.filter((table) => P3_TENANT_TABLES.includes(table))).toEqual([]);
  });

  it('names each cell once and holds unsigned and forged-header cells that must never reach the guard', () => {
    // Act
    const ids = STOREFRONT_ISOLATION_CASES.map((testCase) => testCase.id);
    const unreached = STOREFRONT_ISOLATION_CASES.filter((testCase) => !testCase.reachesGuard);

    // Assert
    expect(new Set(ids).size).toBe(ids.length);
    expect(unreached.map((testCase) => testCase.call(pair).signing.kind)).toEqual(['unsigned', 'signed', 'signed']);
    expect(unreached.every((testCase) => testCase.expect.kind === 'refused')).toBe(true);
  });

  it("reads A's own collection through both membership routes, showing A's product and hiding B's", () => {
    // Arrange
    const ownCollectionIds = ['storefront.collection-own-slug', 'storefront.products-own-collection'];

    // Act
    const cells = STOREFRONT_ISOLATION_CASES.filter((testCase) => ownCollectionIds.includes(testCase.id));

    // Assert
    expect(cells.map((testCase) => testCase.id).sort()).toEqual([...ownCollectionIds].sort());
    for (const testCase of cells) {
      const call = testCase.call(pair);
      expect(call.path).toContain(encodeURIComponent(pair.attacker.collectionSlug));
      expect(call.signing).toEqual({ kind: 'signed', storeId: pair.attacker.storeId });
      expect(testCase.reachesGuard).toBe(true);
      if (testCase.expect.kind !== 'answers') throw new Error(`${testCase.id} must answer`);
      expect(testCase.expect.shows(pair)).toContain(pair.attacker.productName);
      expect(testCase.expect.hides(pair)).toEqual(pair.victim.names);
    }
  });
});

describe('storefrontHeadersOf', () => {
  it('sends only the x-store-id of an unsigned call', () => {
    // Act
    const headers = storefrontHeadersOf(KEY, {
      path: '/store/products',
      signing: { kind: 'unsigned', storeHeader: '9' },
    });

    // Assert
    expect(headers).toEqual({ [INTERNAL_AUTH_HEADERS.storeId]: '9' });
  });

  it('replaces the signed store header with the one sent beside it', () => {
    // Act
    const headers = storefrontHeadersOf(KEY, {
      path: '/store/products',
      signing: { kind: 'signed', storeId: '1', storeHeader: '2' },
    });

    // Assert
    expect(headers[INTERNAL_AUTH_HEADERS.storeId]).toBe('2');
    expect(headers[INTERNAL_AUTH_HEADERS.signature]).toBeDefined();
  });
});

describe('storefrontFailuresOf', () => {
  it('fails a refusal that answers 200 or carries a body', () => {
    // Act
    const failures = storefrontFailuresOf({ kind: 'refused' }, pair, { status: 200, body: 'x' });

    // Assert
    expect(failures).toEqual(['status 200, expected 404', 'a refusal carried a body']);
  });

  it("fails an answer that misses the caller's own data or holds the victim's", () => {
    // Arrange
    const expectation = { kind: 'answers', shows: () => ['Product A'], hides: () => ['Product B'] } as const;

    // Act
    const failures = storefrontFailuresOf(expectation, pair, { status: 200, body: '{"name":"Product B"}' });

    // Assert
    expect(failures).toEqual(['missing its own "Product A"', 'leaked "Product B"']);
  });
});

describe('runStorefrontMatrix', () => {
  it('fails a cell whose call reached the store guard although it must not, in both directions', async () => {
    // Arrange
    const testCase: StorefrontIsolationCase = {
      id: 'probe',
      endpoint: 'GET /store/products',
      title: 'probe',
      call: () => ({ path: '/store/products', signing: { kind: 'unsigned' } }),
      expect: { kind: 'refused' },
      reachesGuard: false,
    };
    let calls = 0;
    const runner = {
      send: () => {
        calls += 1;
        return Promise.resolve({ status: 404, body: '', headers: {} });
      },
      guardCalls: () => calls,
    };

    // Act
    const outcomes = await runStorefrontMatrix(runner, [testCase], { A: holdingsOf('A'), B: holdingsOf('B') });

    // Assert
    expect(outcomes.map((outcome) => [outcome.attacker, outcome.failures])).toEqual([
      ['A', ['store guard ran 1 times']],
      ['B', ['store guard ran 1 times']],
    ]);
  });
});
