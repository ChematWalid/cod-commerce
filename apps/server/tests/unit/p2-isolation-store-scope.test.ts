import { describe, expect, it } from 'vitest';
import { P2_ISOLATION_CASES } from '../isolation/cases';
import { type SweptEndpoints, sweepCases } from '../isolation/endpoint-sweep';
import { IMPORT_ENDPOINTS } from '../isolation/import-operations';
import type { Expectation } from '../isolation/matrix';
import { PACKS_ENDPOINTS } from '../isolation/packs-operations';
import type { BusinessWorld, World } from '../isolation/world-types';

/**
 * The owner-other-store cells (Task 12 review round 2, D2280): the owner of A on A's second store naming the rows of
 * A's first store gets the not-found answer of a foreign id, so the store filter of every by-id read is under test.
 */

const store = (label: string, id: string) => ({ label, id, subdomain: `s-${id}`, channelToken: `token-${id}` });

const businessOf = (label: 'A' | 'B'): BusinessWorld =>
  ({
    label,
    stores: [store(`${label}1`, `${label}-first`), store(`${label}2`, `${label}-second`)],
    owner: { label: `owner ${label}`, token: `owner-${label}` },
    member: { label: `member ${label}`, token: `member-${label}` },
  }) as unknown as BusinessWorld;

const NOT_FOUND: Expectation = { kind: 'code', code: 'NOT_FOUND' };
const REST_NOT_FOUND: Expectation = { kind: 'status', status: 404, code: 'NOT_FOUND' };

/** One operation and one route naming a row, one of each naming none. */
const SAMPLE: SweptEndpoints<string> = {
  prefix: 'sample',
  operations: [
    {
      name: 'row',
      entity: 'pack',
      document: 'query ($id: ID!) { row(id: $id) }',
      variables: (id) => ({ id }),
      foreign: NOT_FOUND,
    },
    { name: 'rows', entity: 'pack', document: 'query { rows }', variables: () => ({}) },
  ],
  routes: [
    {
      method: 'GET',
      route: '/catalog/rows/:id',
      entity: 'pack',
      path: (id) => `/catalog/rows/${id}`,
      foreign: REST_NOT_FOUND,
    },
    { method: 'GET', route: '/catalog/rows', entity: 'pack', path: () => '/catalog/rows' },
  ],
  targetOf: (business) => `row-${business.label}`,
  restTargetOf: (business) => `rest-${business.label}`,
};

describe('the owner-other-store sweep cells', () => {
  const world: World = { a: businessOf('A'), b: businessOf('B'), superadmin: { label: 'superadmin', token: 's' } };
  const cells = sweepCases(SAMPLE).filter((cell) => cell.id.endsWith('.owner-other-store'));

  it('makes one cell per operation and route that names a row', () => {
    // Act
    const ids = cells.map((cell) => cell.id).sort();

    // Assert
    expect(ids).toEqual(['sample.get-/catalog/rows/:id.owner-other-store', 'sample.row.owner-other-store']);
  });

  it("sends A's owner on A's second store naming A's first-store rows, expecting the foreign answer", () => {
    // Act
    const sent = cells.map((cell) => {
      const request = cell.request(world.a, world.b, world);
      const body = request.body as { variables?: unknown } | undefined;
      return {
        caller: request.caller,
        channel: request.channel,
        names: body?.variables ?? request.path,
        expect: cell.expect,
      };
    });

    // Assert
    const onSecondStore = { caller: world.a.owner, channel: { label: 'A2', token: 'token-A-second' } };
    expect(sent).toEqual([
      { ...onSecondStore, names: { id: 'row-A' }, expect: NOT_FOUND },
      { ...onSecondStore, names: '/catalog/rows/rest-A', expect: REST_NOT_FOUND },
    ]);
  });

  it.each([
    ['packs', PACKS_ENDPOINTS as SweptEndpoints<unknown>],
    ['import', IMPORT_ENDPOINTS as SweptEndpoints<unknown>],
  ] as const)('gives every %s endpoint naming a row an owner-other-store cell in the P2 matrix', (_name, endpoints) => {
    // Arrange
    const wanted = [
      ...endpoints.operations.flatMap((op) => (op.foreign === undefined ? [] : [[op.name, op.foreign] as const])),
      ...endpoints.routes.flatMap((route) =>
        route.foreign === undefined ? [] : [[`${route.method} ${route.route}`, route.foreign] as const],
      ),
    ];

    // Act
    const found = wanted.map(([endpoint]) =>
      P2_ISOLATION_CASES.find((cell) => cell.endpoint === endpoint && cell.id.endsWith('.owner-other-store')),
    );

    // Assert
    expect(found.map((cell) => cell?.expect)).toEqual(wanted.map(([, foreign]) => foreign));
  });
});
