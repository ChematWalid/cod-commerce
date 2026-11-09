import type { BusinessFixture, GraphQlDocument, StoreFixture, TwoBusinesses } from '@cod/testing';
import { TenancyPlugin } from '../../tenancy.plugin';
import {
  ACTIVE_BUSINESS,
  ARCHIVE_STORE,
  BUSINESS,
  CHANGE_STORE_SUBDOMAIN,
  CREATE_STORE,
  PROVISION_BUSINESS,
  STORE,
  STORES,
  SUBDOMAIN_AVAILABILITY,
  UPDATE_BUSINESS,
  UPDATE_STORE,
} from './admin-api-operations';

/** What one registry case attacks: B's store `victim`, as a caller from business A. */
export interface Probe extends TwoBusinesses {
  readonly victim: StoreFixture;
}

/** What A's call must come to; it is never B's data. */
export type IsolationOutcome =
  | { readonly kind: 'null' }
  | { readonly kind: 'rejected'; readonly code: string }
  | { readonly kind: 'callerOwned'; readonly businessIdsOf: (value: unknown) => readonly string[] }
  | { readonly kind: 'sameForEveryCaller' };

/** Proves an attack aimed at something real, so `null` or not-found cannot come from a wrong id. */
export type IsolationControl =
  | {
      readonly kind: 'readAsB';
      readonly idsOf: (value: unknown) => readonly string[];
      readonly expected: (probe: Probe) => string;
    }
  | { readonly kind: 'targetExistsInB'; readonly target: (probe: Probe) => string }
  | { readonly kind: 'noForeignTarget' };

/** One Admin API operation and its call from A against B. */
export interface AdminApiEntry {
  readonly operation: string;
  readonly document: GraphQlDocument;
  readonly variables: (probe: Probe) => Record<string, unknown>;
  readonly outcome: IsolationOutcome;
  readonly control: IsolationControl;
}

/** A public REST route. Its answer is exact, and must not depend on who asks. */
export interface RestRouteEntry {
  /** The route as the controller declares it. */
  readonly route: string;
  readonly url: (probe: Probe) => string;
  readonly body: (probe: Probe) => unknown;
}

const STORE_NOT_FOUND = 'tenancy.store-not-found';
const SUBDOMAIN_TAKEN = 'tenancy.subdomain-taken';
const PLATFORM_DOMAIN = 'localhost';
const FORBIDDEN = 'FORBIDDEN';
const TAKEN_MESSAGE = 'This subdomain is already taken';
const OWNER_INPUT = { emailAddress: 'intruder@example.test', firstName: 'A', lastName: 'B', password: 'synthetic' };

const businessIdOfRow = (value: unknown): string => (value as { businessId: string }).businessId;
const idOfRow = (value: unknown): string => (value as { id: string }).id;
const hostOf = (store: StoreFixture): string => `${store.subdomain}.${PLATFORM_DOMAIN}`;

const storeNotFound: IsolationOutcome = { kind: 'rejected', code: STORE_NOT_FOUND };
const victimExists: IsolationControl = { kind: 'targetExistsInB', target: ({ victim }) => victim.id };
const callerBusiness = ({ b }: Probe): string => b.businessId;

/** Every Admin API operation of the plugin; `two-business.isolation` fails on one without an entry. */
export const ADMIN_API_REGISTRY: readonly AdminApiEntry[] = [
  {
    operation: 'activeBusiness',
    document: ACTIVE_BUSINESS,
    variables: () => ({}),
    outcome: { kind: 'callerOwned', businessIdsOf: (value) => [idOfRow(value)] },
    control: { kind: 'readAsB', idsOf: (value) => [idOfRow(value)], expected: callerBusiness },
  },
  {
    operation: 'business',
    document: BUSINESS,
    variables: ({ b }) => ({ id: b.businessId }),
    outcome: { kind: 'null' },
    control: { kind: 'readAsB', idsOf: (value) => [idOfRow(value)], expected: callerBusiness },
  },
  {
    operation: 'stores',
    document: STORES,
    variables: () => ({}),
    outcome: { kind: 'callerOwned', businessIdsOf: (value) => (value as unknown[]).map(businessIdOfRow) },
    control: { kind: 'readAsB', idsOf: (value) => (value as unknown[]).map(businessIdOfRow), expected: callerBusiness },
  },
  {
    operation: 'store',
    document: STORE,
    variables: ({ victim }) => ({ id: victim.id }),
    outcome: { kind: 'null' },
    control: { kind: 'readAsB', idsOf: (value) => [idOfRow(value)], expected: ({ victim }) => victim.id },
  },
  {
    operation: 'subdomainAvailability',
    document: SUBDOMAIN_AVAILABILITY,
    variables: ({ victim }) => ({ subdomain: victim.subdomain }),
    outcome: { kind: 'sameForEveryCaller' },
    control: {
      kind: 'readAsB',
      idsOf: (value) => [(value as { subdomain: string }).subdomain],
      expected: ({ victim }) => victim.subdomain,
    },
  },
  {
    operation: 'provisionBusiness',
    document: PROVISION_BUSINESS,
    variables: ({ victim }) => ({
      input: {
        name: 'Intruder',
        owner: OWNER_INPUT,
        store: { name: 'Intruder', subdomain: `x${victim.subdomain}`, language: 'ar' },
      },
    }),
    outcome: { kind: 'rejected', code: FORBIDDEN },
    control: { kind: 'noForeignTarget' },
  },
  {
    operation: 'updateBusiness',
    document: UPDATE_BUSINESS,
    variables: () => ({ input: { name: 'A renamed' } }),
    outcome: { kind: 'callerOwned', businessIdsOf: (value) => [idOfRow(value)] },
    control: { kind: 'noForeignTarget' },
  },
  {
    operation: 'createStore',
    document: CREATE_STORE,
    variables: ({ victim }) => ({ input: { name: 'Taken', subdomain: victim.subdomain, language: 'ar' } }),
    outcome: { kind: 'rejected', code: SUBDOMAIN_TAKEN },
    control: { kind: 'targetExistsInB', target: ({ victim }) => victim.subdomain },
  },
  {
    operation: 'updateStore',
    document: UPDATE_STORE,
    variables: ({ victim }) => ({ id: victim.id, input: { name: 'Hijacked' } }),
    outcome: storeNotFound,
    control: victimExists,
  },
  {
    operation: 'archiveStore',
    document: ARCHIVE_STORE,
    variables: ({ victim }) => ({ id: victim.id }),
    outcome: storeNotFound,
    control: victimExists,
  },
  {
    operation: 'changeStoreSubdomain',
    document: CHANGE_STORE_SUBDOMAIN,
    variables: ({ victim }) => ({ id: victim.id, subdomain: `moved-${victim.subdomain}` }),
    outcome: storeNotFound,
    control: victimExists,
  },
];

function publicFieldsOf({ b, victim }: Probe): unknown {
  return {
    storeId: victim.id,
    businessId: b.businessId,
    language: 'ar',
    name: `${victim === b.stores[0] ? 'b1' : 'b2'} store`,
    logo: null,
    primaryHost: hostOf(victim),
    status: 'active',
  };
}

/** Every REST route of the plugin; `two-business.isolation` fails on one without an entry. */
export const REST_ROUTE_REGISTRY: readonly RestRouteEntry[] = [
  {
    route: '/stores/subdomain-availability',
    url: ({ victim }) => `/stores/subdomain-availability?subdomain=${victim.subdomain}`,
    body: ({ victim }) => ({ subdomain: victim.subdomain, status: 'taken', reason: TAKEN_MESSAGE }),
  },
  {
    route: '/store/resolve',
    url: ({ victim }) => `/store/resolve?host=${encodeURIComponent(hostOf(victim))}`,
    body: publicFieldsOf,
  },
  { route: '/store/by-id/:storeId', url: ({ victim }) => `/store/by-id/${victim.id}`, body: publicFieldsOf },
];

/** Each registry entry aimed at each of B's two stores. */
export const ATTACK_CASES = ADMIN_API_REGISTRY.flatMap((entry) => [
  { name: `${entry.operation} against B1`, entry, victimIndex: 0 },
  { name: `${entry.operation} against B2`, entry, victimIndex: 1 },
]);

/** The entries that need a role on the channel; a public check answers on any. */
export const GUARDED_ENTRIES = ADMIN_API_REGISTRY.filter((entry) => entry.outcome.kind !== 'sameForEveryCaller');

/** The identifiers of `business` found in a response. */
export function leaksOf(value: unknown, business: BusinessFixture): string[] {
  const text = JSON.stringify(value);
  const identifiers = business.stores.flatMap((store) => [store.id, store.channelToken, store.subdomain]);
  return [business.businessId, ...identifiers].filter((identifier) => text.includes(identifier));
}

type Controller = abstract new (...args: never[]) => object;

/** Every route the plugin's controllers declare, as `/<controller>/<method path>`. */
export function declaredRoutes(): string[] {
  const controllers = Reflect.getMetadata('controllers', TenancyPlugin) as Controller[];
  return controllers.flatMap((controller) => {
    const base = Reflect.getMetadata('path', controller) as string;
    const handlers = Object.getOwnPropertyNames(controller.prototype as object)
      .filter((name) => name !== 'constructor')
      .map((name) => (controller.prototype as Record<string, object>)[name] as object);
    return handlers.flatMap((handler) => {
      const path = Reflect.getMetadata('path', handler) as string | undefined;
      return path === undefined ? [] : [`/${base}/${path}`];
    });
  });
}
