import { type IsolationCase, ownerGraphql, ownerRest, victimChannel } from '../matrix';

const STORE_FIELDS = 'id businessId name subdomain channelToken';
const STORE_BY_ID = `query ($id: String!) { store(id: $id) { ${STORE_FIELDS} } }`;
const SWITCHER = 'query { switchableStores { stores { id businessId name subdomain } } }';
/** The internal-only guard's answer to an unsigned request under /store (D112): 404 with an empty body. */
const NOT_FOUND = 404;

/** Business and stores (plugins/tenancy), and the store switcher. */
export const TENANCY_CASES: readonly IsolationCase[] = [
  {
    id: 'business.active',
    entity: 'business',
    endpoint: 'activeBusiness',
    access: 'list',
    title: "A's owner reads the active business: A's own",
    request: (a) => ownerGraphql(a, 'query { activeBusiness { id name } }'),
    expect: { kind: 'own', mustInclude: (a) => [a.businessId, a.name] },
    reverse: true,
  },
  {
    id: 'business.by-id',
    entity: 'business',
    endpoint: 'business(id)',
    access: 'read by id',
    title: "A's owner asks for B's business by id: null",
    request: (a, b) => ownerGraphql(a, 'query ($id: String!) { business(id: $id) { id name } }', { id: b.businessId }),
    expect: { kind: 'null', field: 'business' },
    reverse: true,
  },
  {
    id: 'business.victim-channel',
    entity: 'business',
    endpoint: 'activeBusiness',
    access: 'victim channel',
    title: "A's owner sends B's store token: FORBIDDEN",
    request: (a, b) => ownerGraphql(a, 'query { activeBusiness { id name } }', {}, victimChannel(b)),
    expect: { kind: 'forbidden' },
    reverse: true,
  },
  {
    id: 'business.update-with-victim-logo',
    entity: 'logo asset',
    endpoint: 'updateBusiness(logoAssetId)',
    access: 'write',
    title: "A's owner sets B's logo asset as A's logo: refused, B's asset untouched",
    request: (a, b) =>
      ownerGraphql(a, 'mutation ($input: UpdateBusinessInput!) { updateBusiness(input: $input) { id } }', {
        input: { logoAssetId: b.logoAssetId },
      }),
    expect: { kind: 'code', code: 'tenancy.asset-not-available' },
  },
  {
    id: 'store.list',
    entity: 'store',
    endpoint: 'stores',
    access: 'list',
    title: "A's owner lists stores: A1 and A2 only",
    request: (a) => ownerGraphql(a, `query { stores { ${STORE_FIELDS} } }`),
    expect: { kind: 'own', mustInclude: (a) => a.stores.map((store) => store.id) },
    reverse: true,
  },
  {
    id: 'store.switcher',
    entity: 'store',
    endpoint: 'switchableStores',
    access: 'list',
    title: "A's owner opens the store switcher: A's stores only",
    request: (a) => ownerGraphql(a, SWITCHER),
    expect: { kind: 'own', mustInclude: (a) => a.stores.map((store) => store.id) },
    reverse: true,
  },
  {
    id: 'store.by-id',
    entity: 'store',
    endpoint: 'store(id)',
    access: 'read by id',
    title: "A's owner asks for B's store by id: null",
    request: (a, b) => ownerGraphql(a, STORE_BY_ID, { id: b.stores[0].id }),
    expect: { kind: 'null', field: 'store' },
    reverse: true,
  },
  {
    id: 'store.update',
    entity: 'store',
    endpoint: 'updateStore(id)',
    access: 'write',
    title: "A's owner renames B's store: tenancy.store-not-found",
    request: (a, b) =>
      ownerGraphql(
        a,
        'mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { id } }',
        {
          id: b.stores[0].id,
          input: { name: 'Taken over' },
        },
      ),
    expect: { kind: 'code', code: 'tenancy.store-not-found' },
    reverse: true,
  },
  {
    id: 'store.change-subdomain',
    entity: 'store',
    endpoint: 'changeStoreSubdomain(id)',
    access: 'write',
    title: "A's owner changes B's subdomain: tenancy.store-not-found",
    request: (a, b) =>
      ownerGraphql(
        a,
        'mutation ($id: String!, $subdomain: String!) { changeStoreSubdomain(id: $id, subdomain: $subdomain) { id } }',
        { id: b.stores[1].id, subdomain: `hijack-${b.stores[1].subdomain}`.slice(0, 30) },
      ),
    expect: { kind: 'code', code: 'tenancy.store-not-found' },
  },
  {
    id: 'store.archive',
    entity: 'store',
    endpoint: 'archiveStore(id)',
    access: 'write',
    title: "A's owner archives B's store: tenancy.store-not-found",
    request: (a, b) =>
      ownerGraphql(a, 'mutation ($id: String!) { archiveStore(id: $id) { id } }', { id: b.stores[1].id }),
    expect: { kind: 'code', code: 'tenancy.store-not-found' },
  },
  {
    id: 'store.victim-channel',
    entity: 'store',
    endpoint: 'stores',
    access: 'victim channel',
    title: "A's owner lists stores with B's store token: FORBIDDEN",
    request: (a, b) => ownerGraphql(a, `query { stores { ${STORE_FIELDS} } }`, {}, victimChannel(b)),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'business.by-id-victim-channel',
    entity: 'business',
    endpoint: 'business(id)',
    access: 'victim channel',
    title: "A's owner asks for B's business by id with B's store token: FORBIDDEN",
    request: (a, b) =>
      ownerGraphql(a, 'query ($id: String!) { business(id: $id) { id name } }', { id: b.businessId }, victimChannel(b)),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'store.switcher-victim-channel',
    entity: 'store',
    endpoint: 'switchableStores',
    access: 'victim channel',
    title: "A's owner opens the store switcher with B's store token: FORBIDDEN (Authenticated is per channel)",
    request: (a, b) => ownerGraphql(a, SWITCHER, {}, victimChannel(b)),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'store.by-id-victim-channel',
    entity: 'store',
    endpoint: 'store(id)',
    access: 'victim channel',
    title: "A's owner asks for B1 by id with B1's store token: FORBIDDEN",
    request: (a, b) => ownerGraphql(a, STORE_BY_ID, { id: b.stores[0].id }, victimChannel(b)),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'store.public-by-id',
    entity: 'store',
    endpoint: 'GET /store/by-id/:storeId',
    access: 'read by id',
    title: "A's owner reads B1 through the storefront lookup with no internal signature: 404, empty body",
    request: (a, b) => ownerRest(a, 'GET', `/store/by-id/${b.stores[0].id}`),
    expect: { kind: 'status', status: NOT_FOUND },
    reverse: true,
  },
  {
    id: 'store.public-resolve',
    entity: 'store',
    endpoint: 'GET /store/resolve?host=',
    access: 'read by id',
    title: "A's owner resolves B1's host through the storefront lookup with no internal signature: 404, empty body",
    request: (a, b) =>
      ownerRest(a, 'GET', `/store/resolve?host=${encodeURIComponent(`${b.stores[0].subdomain}.localhost`)}`),
    expect: { kind: 'status', status: NOT_FOUND },
  },
];
