import type { Caller, MatrixRequest } from '../http';
import { type Expectation, type IsolationAccess, type IsolationCase, ownChannel, victimChannel } from '../matrix';
import {
  OFFER_NOT_FOUND,
  OFFERS_OPERATIONS,
  OFFERS_ROUTES,
  type OffersOperation,
  type OffersRoute,
  type OffersTarget,
  offersTargetOf,
  ownOfferIdsOf,
} from '../offers-operations';
import type { BusinessWorld } from '../world-types';
import { MALFORMED_IDS } from './catalog-sweep';

/**
 * The offers cells (P2.S5 Task 11), over HTTP on the seeded world: each store lists only its own offers; B's offer and
 * its codes by id answer not found on every read, edit, lifecycle move, duplicate, delete and code call (both
 * directions, B's offer holding the same `SAME10` code as A's, D2528); B's store token and a store-restricted member
 * on A's other store are refused on every endpoint; malformed ids answer not found. Built from `offers-operations.ts`,
 * so a new endpoint is covered by adding it there. The in-process rows (quotes, the shared code) are `cases/offers.ts`.
 */

type Channel = NonNullable<MatrixRequest['channel']>;

const FORBIDDEN = 403;
const NOT_FOUND = 404;

/** The second store of `business`: its member reaches the first store only. */
const otherStore = (business: BusinessWorld): Channel => ({
  label: business.stores[1].label,
  token: business.stores[1].channelToken,
});

const operationRequest = (op: OffersOperation, caller: Caller, channel: Channel, t: OffersTarget): MatrixRequest => ({
  method: 'POST',
  path: '/admin-api',
  caller,
  channel,
  body: { query: op.document, variables: op.variables(t) },
});

const routeRequest = (route: OffersRoute, caller: Caller, channel: Channel, t: OffersTarget): MatrixRequest => ({
  method: route.method,
  path: route.path(t),
  caller,
  channel,
  body: route.body?.(t),
});

const routeName = (route: OffersRoute): string => `${route.method} ${route.route}`;
const routeId = (route: OffersRoute): string => `offers.${route.method.toLowerCase()}-${route.route}`;

const accessOf = (foreign: OffersOperation['foreign'], isRead: boolean): IsolationAccess => {
  if (foreign === 'own-only') return 'list';
  return isRead ? 'read by id' : 'write';
};
const operationAccess = (op: OffersOperation): IsolationAccess => accessOf(op.foreign, op.document.startsWith('query'));
const routeAccess = (route: OffersRoute): IsolationAccess => accessOf(route.foreign, route.method === 'GET');

/** A success holding none of the victim's rows (the runner scans every answer for them). */
const OWN_ONLY: Expectation = { kind: 'own', mustInclude: () => [] };

/** What an operation answers for an offer id that is not one of the caller's store. */
const operationForeign = (op: OffersOperation): Expectation => {
  if (op.foreign === 'null') return { kind: 'null', field: op.name };
  if (op.foreign === 'not-found') return { kind: 'code', code: OFFER_NOT_FOUND };
  return OWN_ONLY;
};

const routeForeign = (route: OffersRoute): Expectation =>
  route.foreign === 'not-found' ? { kind: 'status', status: NOT_FOUND, code: OFFER_NOT_FOUND } : OWN_ONLY;

/** A create keeps B's variant id as a dangling reference in A's store (D2536): it is sent on the refused cells only. */
const writesNoRow = (entry: { readonly foreign: OffersOperation['foreign'] }): boolean => entry.foreign !== 'dangling';
const byOfferId = (entry: { readonly foreign: OffersOperation['foreign'] }): boolean =>
  entry.foreign === 'null' || entry.foreign === 'not-found';

/** Each store's list holds its own three offers and none of the other business's (both directions). */
function ownLists(): IsolationCase[] {
  const own: Expectation = { kind: 'own', mustInclude: ownOfferIdsOf };
  return [
    {
      id: 'offers.offers.own-list',
      entity: 'offer',
      endpoint: 'offers',
      access: 'list',
      title: "A's owner lists offers: A's offers only",
      request: (a) => ({
        method: 'POST',
        path: '/admin-api',
        caller: a.owner,
        channel: ownChannel(a),
        body: { query: 'query { offers { totalItems items { id title status } } }', variables: {} },
      }),
      expect: own,
      reverse: true,
    },
    {
      id: 'offers.get-/offers.own-list',
      entity: 'offer',
      endpoint: 'GET /offers',
      access: 'list',
      title: "A's owner lists GET /offers: A's offers only",
      request: (a) => ({ method: 'GET', path: '/offers', caller: a.owner, channel: ownChannel(a) }),
      expect: own,
      reverse: true,
    },
  ];
}

/** A's owner on its own store naming B's offer, code, product or variant (both directions). */
function foreignIds(): IsolationCase[] {
  const ops = OFFERS_OPERATIONS.filter(writesNoRow).map((op): IsolationCase => ({
    id: `offers.${op.name}.foreign-id`,
    entity: op.entity,
    endpoint: op.name,
    access: operationAccess(op),
    title: `A's owner calls ${op.name} naming B's ${op.entity}: ${op.foreign}`,
    request: (a, b) => operationRequest(op, a.owner, ownChannel(a), offersTargetOf(b)),
    expect: operationForeign(op),
    reverse: true,
  }));
  const routes = OFFERS_ROUTES.filter(writesNoRow).map((route): IsolationCase => ({
    id: `${routeId(route)}.foreign-id`,
    entity: route.entity,
    endpoint: routeName(route),
    access: routeAccess(route),
    title: `A's owner calls ${routeName(route)} naming B's ${route.entity}: ${route.foreign}`,
    request: (a, b) => routeRequest(route, a.owner, ownChannel(a), offersTargetOf(b)),
    expect: routeForeign(route),
    reverse: true,
  }));
  return [...ops, ...routes];
}

/** `caller(attacker)` on `channel(attacker, victim)` naming `target`'s rows: refused on every endpoint. */
function refusedEverywhere(
  suffix: string,
  title: string,
  request: {
    readonly caller: (attacker: BusinessWorld) => Caller;
    readonly channel: (attacker: BusinessWorld, victim: BusinessWorld) => Channel;
    readonly target: (attacker: BusinessWorld, victim: BusinessWorld) => OffersTarget;
  },
): IsolationCase[] {
  const ops = OFFERS_OPERATIONS.map((op): IsolationCase => ({
    id: `offers.${op.name}.${suffix}`,
    entity: op.entity,
    endpoint: op.name,
    access: 'victim channel',
    title: `${title} calls ${op.name}: FORBIDDEN`,
    request: (a, b) => operationRequest(op, request.caller(a), request.channel(a, b), request.target(a, b)),
    expect: { kind: 'forbidden' },
    reverse: true,
  }));
  const routes = OFFERS_ROUTES.map((route): IsolationCase => ({
    id: `${routeId(route)}.${suffix}`,
    entity: route.entity,
    endpoint: routeName(route),
    access: 'victim channel',
    title: `${title} calls ${routeName(route)}: ${String(FORBIDDEN)}`,
    request: (a, b) => routeRequest(route, request.caller(a), request.channel(a, b), request.target(a, b)),
    expect: { kind: 'status', status: FORBIDDEN },
    reverse: true,
  }));
  return [...ops, ...routes];
}

/** A malformed offer id on every by-id endpoint: not found (404 over REST), with no SQL or entity text. */
function malformedIds(): IsolationCase[] {
  const ops = OFFERS_OPERATIONS.filter(byOfferId).flatMap((op) =>
    MALFORMED_IDS.map((id): IsolationCase => ({
      id: `offers.${op.name}.malformed-id-${JSON.stringify(id)}`,
      entity: op.entity,
      endpoint: op.name,
      access: operationAccess(op),
      title: `A's owner calls ${op.name} with the malformed id ${JSON.stringify(id)}: not found`,
      request: (a) => operationRequest(op, a.owner, ownChannel(a), { ...offersTargetOf(a), offerId: id }),
      expect: operationForeign(op),
    })),
  );
  const routes = OFFERS_ROUTES.filter(byOfferId).flatMap((route) =>
    MALFORMED_IDS.filter((id) => id !== '').map((id): IsolationCase => ({
      id: `${routeId(route)}.malformed-id-${JSON.stringify(id)}`,
      entity: route.entity,
      endpoint: routeName(route),
      access: routeAccess(route),
      title: `A's owner calls ${routeName(route)} with the malformed id ${JSON.stringify(id)}: ${String(NOT_FOUND)}`,
      request: (a) =>
        routeRequest(route, a.owner, ownChannel(a), { ...offersTargetOf(a), offerId: encodeURIComponent(id) }),
      expect: { kind: 'status', status: NOT_FOUND, code: OFFER_NOT_FOUND },
    })),
  );
  return [...ops, ...routes];
}

/** Every generated offers cell. */
export const OFFERS_SWEEP_CASES: readonly IsolationCase[] = [
  ...ownLists(),
  ...foreignIds(),
  ...refusedEverywhere('victim-channel', "A's owner with B's store token", {
    caller: (a) => a.owner,
    channel: (_a, b) => victimChannel(b),
    target: (_a, b) => offersTargetOf(b),
  }),
  ...refusedEverywhere('member-other-store', "A's member (first store only) with A's second store token", {
    caller: (a) => a.member,
    channel: (a) => otherStore(a),
    target: (a) => offersTargetOf(a),
  }),
  ...malformedIds(),
];
