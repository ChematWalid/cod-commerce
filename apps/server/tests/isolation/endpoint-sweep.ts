import type { Caller, MatrixRequest } from './http';
import { type Expectation, type IsolationCase, type IsolationEntity, ownChannel, victimChannel } from './matrix';
import type { BusinessWorld } from './world-types';

/**
 * The generated cells of a plugin's endpoint list (P2.S2 packs and import, after the catalog's `catalog-sweep.ts`):
 * the victim's rows named by id (both directions), the owner's second store naming its first store's rows (D2280),
 * the victim's store token, and a store-restricted member on the store it may not reach (D2132). A new endpoint is
 * covered by adding it to its list.
 */

type Channel = NonNullable<MatrixRequest['channel']>;

const FORBIDDEN = 403;

/** One Admin API operation, aimed at the rows of `T`. */
export interface SweptOperation<T> {
  readonly name: string;
  readonly entity: IsolationEntity;
  readonly document: string;
  readonly variables: (target: T) => Record<string, unknown>;
  /** What the attacker gets back naming the victim's rows; absent for an operation that names no row. */
  readonly foreign?: Expectation;
}

/** One REST route, aimed at the rows of `T`. */
export interface SweptRoute<T> {
  readonly method: MatrixRequest['method'];
  /** The route as the controller declares it, e.g. `/catalog/packs/:productId`. */
  readonly route: string;
  readonly entity: IsolationEntity;
  readonly path: (target: T) => string;
  readonly body?: (target: T) => Record<string, unknown>;
  /** What the attacker gets back naming the victim's rows; absent for a route that names no row. */
  readonly foreign?: Expectation;
}

/** A plugin's endpoints and how a business's rows are spelled for them (GraphQL ids, REST ids). */
export interface SweptEndpoints<T> {
  /** Prefixes every cell id, e.g. `packs`. */
  readonly prefix: string;
  readonly operations: readonly SweptOperation<T>[];
  readonly routes: readonly SweptRoute<T>[];
  readonly targetOf: (business: BusinessWorld) => T;
  readonly restTargetOf: (business: BusinessWorld) => T;
}

/** The second store of `business`: its member reaches the first store only. */
export const otherStore = (business: BusinessWorld): Channel => ({
  label: business.stores[1].label,
  token: business.stores[1].channelToken,
});

/** An operation as `caller` on `channel`, with `variables`. */
export const operationRequest = (
  document: string,
  variables: Record<string, unknown>,
  { caller, channel }: { readonly caller: Caller; readonly channel: Channel },
): MatrixRequest => ({ method: 'POST', path: '/admin-api', caller, channel, body: { query: document, variables } });

/** A route as `caller` on `channel`, naming `target`'s rows. */
function routeRequest<T>(route: SweptRoute<T>, target: T, who: { caller: Caller; channel: Channel }): MatrixRequest {
  return {
    method: route.method,
    path: route.path(target),
    caller: who.caller,
    channel: who.channel,
    body: route.body?.(target),
  };
}

/** A route as the matrix and the unit test name it: `METHOD /path`. */
export const routeName = (route: { readonly method: string; readonly route: string }): string =>
  `${route.method} ${route.route}`;

const routeId = (prefix: string, route: { readonly method: string; readonly route: string }): string =>
  `${prefix}.${route.method.toLowerCase()}-${route.route}`;

const accessOf = (document: string): 'read by id' | 'write' => (document.startsWith('query') ? 'read by id' : 'write');

/** Who calls on which store in a cell, and whose rows the call names. */
interface Reach {
  readonly caller: Caller;
  readonly channel: Channel;
  readonly target: BusinessWorld;
}

/** A cell family: its id suffix, the title of each cell, and how the attacker reaches. */
interface Refusal {
  readonly suffix: string;
  readonly who: string;
  readonly reach: (a: BusinessWorld, b: BusinessWorld) => Reach;
}

/** A cell family that names rows by id and expects each endpoint's `foreign` answer (not found). */
interface NotFoundFamily extends Refusal {
  readonly whose: string;
}

const NOT_FOUND_FAMILIES: readonly NotFoundFamily[] = [
  {
    suffix: 'foreign-id',
    who: "A's owner",
    whose: "B's",
    reach: (a, b) => ({ caller: a.owner, channel: ownChannel(a), target: b }),
  },
  {
    // D2280: the owner reaches both stores, so only each read's store filter keeps store 1's rows from store 2.
    suffix: 'owner-other-store',
    who: "A's owner with A's second store token",
    whose: "A's first-store",
    reach: (a) => ({ caller: a.owner, channel: otherStore(a), target: a }),
  },
];

/** Every endpoint that names a row, called as `family` says: each answers its `foreign` expectation. */
function notFoundCells<T>(endpoints: SweptEndpoints<T>, family: NotFoundFamily): IsolationCase[] {
  const { prefix, targetOf, restTargetOf } = endpoints;
  const titleOf = (endpoint: string, entity: string): string =>
    `${family.who} calls ${endpoint} naming ${family.whose} ${entity}: those rows stay out of reach`;
  const ops = endpoints.operations.flatMap((op): IsolationCase[] => {
    const { foreign } = op;
    if (foreign === undefined) return [];
    const cell: IsolationCase = {
      id: `${prefix}.${op.name}.${family.suffix}`,
      entity: op.entity,
      endpoint: op.name,
      access: accessOf(op.document),
      title: titleOf(op.name, op.entity),
      request: (a, b) => {
        const { caller, channel, target } = family.reach(a, b);
        return operationRequest(op.document, op.variables(targetOf(target)), { caller, channel });
      },
      expect: foreign,
      reverse: true,
    };
    return [cell];
  });
  const routes = endpoints.routes.flatMap((route): IsolationCase[] => {
    const { foreign } = route;
    if (foreign === undefined) return [];
    const cell: IsolationCase = {
      id: `${routeId(prefix, route)}.${family.suffix}`,
      entity: route.entity,
      endpoint: routeName(route),
      access: route.method === 'GET' ? 'read by id' : 'write',
      title: titleOf(routeName(route), route.entity),
      request: (a, b) => {
        const { caller, channel, target } = family.reach(a, b);
        return routeRequest(route, restTargetOf(target), { caller, channel });
      },
      expect: foreign,
      reverse: true,
    };
    return [cell];
  });
  return [...ops, ...routes];
}

const REFUSALS: readonly Refusal[] = [
  {
    suffix: 'victim-channel',
    who: "A's owner with B's store token",
    reach: (a, b) => ({ caller: a.owner, channel: victimChannel(b), target: b }),
  },
  {
    suffix: 'member-other-store',
    who: "A's member (first store only) with A's second store token",
    reach: (a) => ({ caller: a.member, channel: otherStore(a), target: a }),
  },
];

/** Every endpoint refused (FORBIDDEN, 403 over REST) on a store the caller may not reach. */
function refusedCells<T>(endpoints: SweptEndpoints<T>, refusal: Refusal): IsolationCase[] {
  const { prefix, targetOf, restTargetOf } = endpoints;
  const ops = endpoints.operations.map((op): IsolationCase => ({
    id: `${prefix}.${op.name}.${refusal.suffix}`,
    entity: op.entity,
    endpoint: op.name,
    access: 'victim channel',
    title: `${refusal.who} calls ${op.name}: FORBIDDEN`,
    request: (a, b) => {
      const { caller, channel, target } = refusal.reach(a, b);
      return operationRequest(op.document, op.variables(targetOf(target)), { caller, channel });
    },
    expect: { kind: 'forbidden' },
    reverse: true,
  }));
  const routes = endpoints.routes.map((route): IsolationCase => ({
    id: `${routeId(prefix, route)}.${refusal.suffix}`,
    entity: route.entity,
    endpoint: routeName(route),
    access: 'victim channel',
    title: `${refusal.who} calls ${routeName(route)}: ${String(FORBIDDEN)}`,
    request: (a, b) => {
      const { caller, channel, target } = refusal.reach(a, b);
      return routeRequest(route, restTargetOf(target), { caller, channel });
    },
    expect: { kind: 'status', status: FORBIDDEN },
    reverse: true,
  }));
  return [...ops, ...routes];
}

/** Every generated cell of `endpoints`. */
export function sweepCases<T>(endpoints: SweptEndpoints<T>): IsolationCase[] {
  return [
    ...NOT_FOUND_FAMILIES.flatMap((family) => notFoundCells(endpoints, family)),
    ...REFUSALS.flatMap((refusal) => refusedCells(endpoints, refusal)),
  ];
}
