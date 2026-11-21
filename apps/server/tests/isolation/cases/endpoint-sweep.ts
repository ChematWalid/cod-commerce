import { type CatalogOperation, type CatalogRoute, type CatalogTarget, ENGINE_ID_FIELDS } from '../catalog-operations';
import type { Caller, MatrixRequest } from '../http';
import { type Expectation, type IsolationCase, ownChannel, victimChannel } from '../matrix';
import { ONE_PIXEL_PNG } from '../seed-operations';
import type { BusinessWorld } from '../world-types';

/**
 * The cells every endpoint of a P2 plugin gets (P2.S1, D2115): B's row by id (GraphQL and REST, both directions), the
 * victim's store token, a store-restricted member on the store it may not reach (D2132), and malformed ids (D2136).
 * Built from an endpoint list (`catalog-operations.ts`, `collections-operations.ts`), so a new endpoint is covered by
 * adding it there.
 */

type Channel = NonNullable<MatrixRequest['channel']>;

const FORBIDDEN = 403;
const NOT_FOUND = 404;
/** Ids that are no row of anyone's: they must answer "not found", never reach Postgres (D2136). */
export const MALFORMED_IDS = ['abc', '-1', '1.5', '99999999999999999999', ''];

/** A fractional id: the REST routes and our `String` ids take it as sent. */
const FRACTIONAL_ID = '1.5';

/**
 * Whether a malformed id reaches the plugin as written. A GraphQL `ID` argument is decoded by the entity id strategy
 * first: the e2e boot's testing strategy `parseInt`s it, so `"1.5"` names engine row 1 (perhaps the caller's own
 * product or collection) before the plugin sees it. The catalog's integration sweep boots the same testing strategy
 * and skips it too. Production's `AutoIncrementIdStrategy` hands over the number 1.5, which the plugins refuse: only
 * the catalog unit test `production-id-decoding.test.ts` runs that decoding; the REST cells send the text as written.
 */
const reachesPluginAsSent = (op: CatalogOperation, id: string): boolean =>
  !(id === FRACTIONAL_ID && op.byId !== undefined && ENGINE_ID_FIELDS.has(op.byId.field));

/** The second store of `business`: its member reaches the first store only. */
const otherStore = (business: BusinessWorld): Channel => ({
  label: business.stores[1].label,
  token: business.stores[1].channelToken,
});

/** An operation as `caller` on `channel`, naming `target`'s rows; an upload carries a one-pixel PNG. */
export function operationRequest(
  op: CatalogOperation,
  caller: Caller,
  channel: Channel,
  target: CatalogTarget,
): MatrixRequest {
  const body = { query: op.document, variables: op.variables(target) };
  const upload = op.upload === true ? { bytes: ONE_PIXEL_PNG, name: 'photo.png' } : undefined;
  return { method: 'POST', path: '/admin-api', caller, channel, body, ...(upload && { upload }) };
}

/** A route as `caller` on `channel`, naming `target`'s rows. */
export const routeRequest = (
  route: CatalogRoute,
  caller: Caller,
  channel: Channel,
  target: CatalogTarget,
): MatrixRequest => ({
  method: route.method,
  path: route.path(target),
  caller,
  channel,
  body: route.body?.(),
});

/** A route as cell titles name it: `GET /catalog/collections/:id`. */
export const routeName = (route: CatalogRoute): string => `${route.method} ${route.route}`;
/** How the matrix files an operation: a query reads by id, a mutation writes. */
export const accessOf = (op: CatalogOperation): 'read by id' | 'write' =>
  op.document.startsWith('query') ? 'read by id' : 'write';

/** What an operation answers for an id that is no row of the caller's store. */
export const notFoundOf = (op: CatalogOperation): Expectation =>
  op.byId?.notFound === null || op.byId === undefined
    ? { kind: 'null', field: op.name }
    : { kind: 'code', code: op.byId.notFound };

/** The endpoint list of one plugin, and the prefix of its cell ids. */
export interface SweptEndpoints {
  /** `catalog`, `collections`: the first part of every cell id. */
  readonly prefix: string;
  readonly operations: readonly CatalogOperation[];
  readonly routes: readonly CatalogRoute[];
  /** The rows of a business as GraphQL names them. */
  readonly targetOf: (business: BusinessWorld) => CatalogTarget;
  /** The rows of a business as the REST routes name them. */
  readonly restTargetOf: (business: BusinessWorld) => CatalogTarget;
}

const routeId = (prefix: string, route: CatalogRoute): string =>
  `${prefix}.${route.method.toLowerCase()}-${route.route}`;

function foreignOperation({ prefix, targetOf }: SweptEndpoints, op: CatalogOperation): IsolationCase {
  return {
    id: `${prefix}.${op.name}.foreign-id`,
    entity: op.entity,
    endpoint: op.name,
    access: accessOf(op),
    title: `A's owner calls ${op.name} on B's ${op.entity}: not found`,
    request: (a, b) => operationRequest(op, a.owner, ownChannel(a), targetOf(b)),
    expect: notFoundOf(op),
    reverse: true,
  };
}

function foreignRoute(
  { prefix, restTargetOf }: SweptEndpoints,
  route: CatalogRoute & { byId: NonNullable<CatalogRoute['byId']> },
): IsolationCase {
  return {
    id: `${routeId(prefix, route)}.foreign-id`,
    entity: route.entity,
    endpoint: routeName(route),
    access: route.method === 'GET' ? 'read by id' : 'write',
    title: `A's owner calls ${routeName(route)} on B's ${route.entity}: ${String(NOT_FOUND)} ${route.byId.notFound}`,
    request: (a, b) => routeRequest(route, a.owner, ownChannel(a), restTargetOf(b)),
    expect: { kind: 'status', status: NOT_FOUND, code: route.byId.notFound },
    reverse: true,
  };
}

/** A's owner with B's store token, naming B's rows: FORBIDDEN, 403 over REST (the tenant guard refuses first). */
function onVictimStore({ prefix, operations, routes, targetOf, restTargetOf }: SweptEndpoints): IsolationCase[] {
  const ops = operations.map((op): IsolationCase => ({
    id: `${prefix}.${op.name}.victim-channel`,
    entity: op.entity,
    endpoint: op.name,
    access: 'victim channel',
    title: `A's owner calls ${op.name} with B's store token: FORBIDDEN`,
    request: (a, b) => operationRequest(op, a.owner, victimChannel(b), targetOf(b)),
    expect: { kind: 'forbidden' },
    reverse: true,
  }));
  const routeCases = routes.map((route): IsolationCase => ({
    id: `${routeId(prefix, route)}.victim-channel`,
    entity: route.entity,
    endpoint: routeName(route),
    access: 'victim channel',
    title: `A's owner calls ${routeName(route)} with B's store token: ${String(FORBIDDEN)}`,
    request: (a, b) => routeRequest(route, a.owner, victimChannel(b), restTargetOf(b)),
    expect: { kind: 'status', status: FORBIDDEN },
    reverse: true,
  }));
  return [...ops, ...routeCases];
}

/** A's member, limited to A's first store, with A's second store token: FORBIDDEN on every endpoint (D2132). */
function memberOnOtherStore({ prefix, operations, routes, targetOf, restTargetOf }: SweptEndpoints): IsolationCase[] {
  const ops = operations.map((op): IsolationCase => ({
    id: `${prefix}.${op.name}.member-other-store`,
    entity: op.entity,
    endpoint: op.name,
    access: 'victim channel',
    title: `A's member (first store only) calls ${op.name} with A's second store token: FORBIDDEN`,
    request: (a) => operationRequest(op, a.member, otherStore(a), targetOf(a)),
    expect: { kind: 'forbidden' },
    reverse: true,
  }));
  const routeCases = routes.map((route): IsolationCase => ({
    id: `${routeId(prefix, route)}.member-other-store`,
    entity: route.entity,
    endpoint: routeName(route),
    access: 'victim channel',
    title: `A's member (first store only) calls ${routeName(route)} with A's second store token: ${String(FORBIDDEN)}`,
    request: (a) => routeRequest(route, a.member, otherStore(a), restTargetOf(a)),
    expect: { kind: 'status', status: FORBIDDEN },
    reverse: true,
  }));
  return [...ops, ...routeCases];
}

/** A malformed id on every by-id endpoint: not found (404 over REST), with no SQL or entity text (D2136). */
function malformedOperationIds({ prefix, operations, targetOf }: SweptEndpoints): IsolationCase[] {
  return operations.flatMap((op) => {
    const { byId } = op;
    if (byId === undefined) return [];
    return MALFORMED_IDS.filter((id) => reachesPluginAsSent(op, id)).map((id): IsolationCase => ({
      id: `${prefix}.${op.name}.malformed-id-${JSON.stringify(id)}`,
      entity: op.entity,
      endpoint: op.name,
      access: accessOf(op),
      title: `A's owner calls ${op.name} with the malformed id ${JSON.stringify(id)}: not found`,
      request: (a) => operationRequest(op, a.owner, ownChannel(a), { ...targetOf(a), [byId.field]: id }),
      expect: notFoundOf(op),
    }));
  });
}

function malformedRouteIds({ prefix, routes, restTargetOf }: SweptEndpoints): IsolationCase[] {
  return routes.flatMap((route) => {
    const { byId } = route;
    if (byId === undefined) return [];
    return MALFORMED_IDS.filter((id) => id !== '').map((id): IsolationCase => ({
      id: `${routeId(prefix, route)}.malformed-id-${JSON.stringify(id)}`,
      entity: route.entity,
      endpoint: routeName(route),
      access: route.method === 'GET' ? 'read by id' : 'write',
      title: `A's owner calls ${routeName(route)} with the malformed id ${JSON.stringify(id)}: ${String(NOT_FOUND)}`,
      request: (a) =>
        routeRequest(route, a.owner, ownChannel(a), { ...restTargetOf(a), [byId.field]: encodeURIComponent(id) }),
      expect: { kind: 'status', status: NOT_FOUND },
    }));
  });
}

const withById = (route: CatalogRoute): route is CatalogRoute & { byId: NonNullable<CatalogRoute['byId']> } =>
  route.byId !== undefined;

/** Every generated cell of `endpoints`. */
export function sweepCasesOf(endpoints: SweptEndpoints): IsolationCase[] {
  return [
    ...endpoints.operations.filter((op) => op.byId !== undefined).map((op) => foreignOperation(endpoints, op)),
    ...endpoints.routes.filter(withById).map((route) => foreignRoute(endpoints, route)),
    ...onVictimStore(endpoints),
    ...memberOnOtherStore(endpoints),
    ...malformedOperationIds(endpoints),
    ...malformedRouteIds(endpoints),
  ];
}
