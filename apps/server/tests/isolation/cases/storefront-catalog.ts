/**
 * The P3 isolation cells of the storefront API (P3.S2, D3201): `/store/*` serves the store the internal signature
 * covers (D111), never one a client names. Each cell runs from A against B and from B against A.
 */

/** What one business's first store shows on the storefront, read back by the P3 world after seeding. */
export interface StorefrontHoldings {
  readonly storeId: string;
  /** The names of the store's listed products. */
  readonly names: readonly string[];
  /** A listed product's slug and name. */
  readonly productSlug: string;
  readonly productName: string;
  /** A word of that product's name, which the store's search finds it by. */
  readonly searchTerm: string;
  /** A visible collection's slug. */
  readonly collectionSlug: string;
}

/** The two stores of one run: the caller's and the one it reaches for. */
export interface StorefrontPair {
  readonly attacker: StorefrontHoldings;
  readonly victim: StorefrontHoldings;
}

/**
 * How a call is sent: unsigned, or signed for `storeId` (none: a signature that covers no store). `storeHeader` is an
 * `x-store-id` sent beside it, replacing the signed one when both are set.
 */
export type StorefrontSigning =
  | { readonly kind: 'unsigned'; readonly storeHeader?: string }
  | { readonly kind: 'signed'; readonly storeId?: string; readonly storeHeader?: string };

/** One GET of the storefront API. */
export interface StorefrontCall {
  /** The path and query exactly as sent and signed. */
  readonly path: string;
  readonly signing: StorefrontSigning;
}

/** What the caller must get back. */
export type StorefrontExpectation =
  /** 404 with an empty body: no route, store or row is confirmed. */
  | { readonly kind: 'refused' }
  /** 200 holding every `shows` value and none of the `hides` values. */
  | {
      readonly kind: 'answers';
      readonly shows: (pair: StorefrontPair) => readonly string[];
      readonly hides: (pair: StorefrontPair) => readonly string[];
    };

/** One cell: a route, a call and what must come back. */
export interface StorefrontIsolationCase {
  readonly id: string;
  /** The declared route, as `GET /store/...`. */
  readonly endpoint: string;
  readonly title: string;
  readonly call: (pair: StorefrontPair) => StorefrontCall;
  readonly expect: StorefrontExpectation;
  /**
   * Whether the call passes the internal-only middleware and reaches `StorefrontStoreGuard`; an unsigned or forged
   * store header must never reach it.
   */
  readonly reachesGuard: boolean;
}

const REFUSED: StorefrontExpectation = { kind: 'refused' };
const asAttacker = (pair: StorefrontPair): StorefrontSigning => ({ kind: 'signed', storeId: pair.attacker.storeId });
const PRODUCTS = 'GET /store/products';
const productPath = (slug: string): string => `/store/product/${encodeURIComponent(slug)}`;
const collectionPath = (slug: string): string => `/store/collection/${encodeURIComponent(slug)}`;

/** Cells that read through each route as the signed attacker store. */
const ROUTE_CASES: readonly StorefrontIsolationCase[] = [
  {
    id: 'storefront.products-own',
    endpoint: PRODUCTS,
    title: "A's signed list holds A's products and none of B's",
    call: (pair) => ({ path: '/store/products?take=50', signing: asAttacker(pair) }),
    expect: { kind: 'answers', shows: (pair) => pair.attacker.names, hides: (pair) => pair.victim.names },
    reachesGuard: true,
  },
  {
    id: 'storefront.products-victim-collection',
    endpoint: PRODUCTS,
    title: "A's signed list filtered by B's collection slug: 404, empty body",
    call: (pair) => ({
      path: `/store/products?collection=${encodeURIComponent(pair.victim.collectionSlug)}`,
      signing: asAttacker(pair),
    }),
    expect: REFUSED,
    reachesGuard: true,
  },
  {
    id: 'storefront.products-own-collection',
    endpoint: PRODUCTS,
    title: "A's signed list filtered by A's collection slug holds A's product and none of B's",
    call: (pair) => ({
      path: `/store/products?collection=${encodeURIComponent(pair.attacker.collectionSlug)}&take=50`,
      signing: asAttacker(pair),
    }),
    expect: { kind: 'answers', shows: (pair) => [pair.attacker.productName], hides: (pair) => pair.victim.names },
    reachesGuard: true,
  },
  {
    id: 'storefront.search-own-term',
    endpoint: 'GET /store/product/search',
    title: "A's signed search for a word of A's product finds it and none of B's products",
    call: (pair) => ({
      path: `/store/product/search?q=${encodeURIComponent(pair.attacker.searchTerm)}`,
      signing: asAttacker(pair),
    }),
    expect: { kind: 'answers', shows: (pair) => [pair.attacker.productName], hides: (pair) => pair.victim.names },
    reachesGuard: true,
  },
  {
    id: 'storefront.search-victim-term',
    endpoint: 'GET /store/product/search',
    title: "A's signed search for a word of B's product never answers B's products",
    call: (pair) => ({
      path: `/store/product/search?q=${encodeURIComponent(pair.victim.searchTerm)}`,
      signing: asAttacker(pair),
    }),
    expect: { kind: 'answers', shows: () => [], hides: (pair) => pair.victim.names },
    reachesGuard: true,
  },
  {
    id: 'storefront.product-own-slug',
    endpoint: 'GET /store/product/:slug',
    title: "A's signed product page of A's slug answers A's product",
    call: (pair) => ({ path: productPath(pair.attacker.productSlug), signing: asAttacker(pair) }),
    expect: { kind: 'answers', shows: (pair) => [pair.attacker.productName], hides: (pair) => pair.victim.names },
    reachesGuard: true,
  },
  {
    id: 'storefront.product-victim-slug',
    endpoint: 'GET /store/product/:slug',
    title: "A's signed product page of B's slug: 404, empty body",
    call: (pair) => ({ path: productPath(pair.victim.productSlug), signing: asAttacker(pair) }),
    expect: REFUSED,
    reachesGuard: true,
  },
  {
    id: 'storefront.collections-own',
    endpoint: 'GET /store/collections',
    title: "A's signed collection list holds A's collection and not B's",
    call: (pair) => ({ path: '/store/collections', signing: asAttacker(pair) }),
    expect: {
      kind: 'answers',
      shows: (pair) => [pair.attacker.collectionSlug],
      hides: (pair) => [pair.victim.collectionSlug],
    },
    reachesGuard: true,
  },
  {
    id: 'storefront.collection-own-slug',
    endpoint: 'GET /store/collection/:slug',
    title: "A's signed collection page of A's slug answers A's collection with A's product and none of B's",
    call: (pair) => ({ path: `${collectionPath(pair.attacker.collectionSlug)}?take=50`, signing: asAttacker(pair) }),
    expect: {
      kind: 'answers',
      shows: (pair) => [pair.attacker.collectionSlug, pair.attacker.productName],
      hides: (pair) => pair.victim.names,
    },
    reachesGuard: true,
  },
  {
    id: 'storefront.collection-victim-slug',
    endpoint: 'GET /store/collection/:slug',
    title: "A's signed collection page of B's slug: 404, empty body",
    call: (pair) => ({ path: collectionPath(pair.victim.collectionSlug), signing: asAttacker(pair) }),
    expect: REFUSED,
    reachesGuard: true,
  },
];

/** Cells where the store comes from anything but the signature (D111, D3201). */
const SIGNING_CASES: readonly StorefrontIsolationCase[] = [
  {
    id: 'storefront.unsigned-store-header',
    endpoint: PRODUCTS,
    title: 'An unsigned list with x-store-id = B: 404 from the middleware, never reaching the store guard',
    call: (pair) => ({ path: '/store/products', signing: { kind: 'unsigned', storeHeader: pair.victim.storeId } }),
    expect: REFUSED,
    reachesGuard: false,
  },
  {
    id: 'storefront.store-header-beside-storeless-signature',
    endpoint: PRODUCTS,
    title: 'A list signed for no store with x-store-id = B added: 404, the signature does not cover it',
    call: (pair) => ({ path: '/store/products', signing: { kind: 'signed', storeHeader: pair.victim.storeId } }),
    expect: REFUSED,
    reachesGuard: false,
  },
  {
    id: 'storefront.swapped-store-header',
    endpoint: PRODUCTS,
    title: 'A list signed for A whose x-store-id is swapped to B: 404, the signature covers the store',
    call: (pair) => ({
      path: '/store/products',
      signing: { kind: 'signed', storeId: pair.attacker.storeId, storeHeader: pair.victim.storeId },
    }),
    expect: REFUSED,
    reachesGuard: false,
  },
  {
    id: 'storefront.signed-without-store',
    endpoint: PRODUCTS,
    title: 'A list signed for no store: the store guard answers 404, empty body',
    call: () => ({ path: '/store/products', signing: { kind: 'signed' } }),
    expect: REFUSED,
    reachesGuard: true,
  },
  {
    id: 'storefront.signed-for-victim-store',
    endpoint: PRODUCTS,
    title:
      "A list signed for B's store with the shared kid answers B's products and none of A's: the signed store wins",
    call: (pair) => ({ path: '/store/products?take=50', signing: { kind: 'signed', storeId: pair.victim.storeId } }),
    expect: { kind: 'answers', shows: (pair) => pair.victim.names, hides: (pair) => pair.attacker.names },
    reachesGuard: true,
  },
];

/** Every cell of the P3 storefront isolation matrix. */
export const STOREFRONT_ISOLATION_CASES: readonly StorefrontIsolationCase[] = [...ROUTE_CASES, ...SIGNING_CASES];
