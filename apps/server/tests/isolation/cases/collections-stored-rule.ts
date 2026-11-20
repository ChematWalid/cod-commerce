import { expect, it } from 'vitest';
import { catalogOf, restIdOf } from '../catalog-world';
import { collectionsOf } from '../collections-world';
import { fieldOf, type IsolationHttp } from '../http';
import { ownChannel } from '../matrix';
import { untilHolds } from '../poll';
import { CREATE_STORE_COLLECTION } from '../seed-operations';
import type { World } from '../world';
import type { BusinessWorld } from '../world-types';

/**
 * A stored rule of the attacker naming the victim's tag and brand (D2307), through the writers of `collections_member`,
 * not the preview: the save's own recompute (D2334), then the `collections-membership` consumer of a `product.changed`
 * the victim's edit publishes (D2336). After each, the collection holds the attacker's matching product only: its member
 * rows are exactly that product in the attacker's first store, and no row outside the victim's business names a victim
 * product. Run both ways. Outside the matrix, since the attacker's own answer echoes the victim's ids in its rule, which
 * the leak scanner cannot tell from a leak; the collection is deleted after, so the snapshots stay as they were.
 */

/** What runs the raw member and delivery queries. */
export interface MemberRowsRunner {
  query(sql: string, parameters: unknown[]): Promise<unknown>;
}

/** What the stored-rule check needs from the suite. */
export interface StoredRuleHarness {
  readonly world: () => World;
  readonly http: IsolationHttp;
  readonly sql: () => MemberRowsRunner;
}

type Pair = readonly [attacker: BusinessWorld, victim: BusinessWorld];

const SETTLE_WAIT_MS = 30_000;
const TEST_TIMEOUT_MS = SETTLE_WAIT_MS * 3;
const POSITION = 9;

const PRODUCTS = 'query ($id: ID!) { storeCollectionProducts(id: $id) { totalItems items { productId title } } }';
const DELETE = 'mutation ($id: ID!) { deleteStoreCollection(id: $id) }';
const RETAG = `mutation ($id: ID!, $input: UpdateCatalogProductInput!) {
  updateCatalogProduct(id: $id, input: $input) { product { id } }
}`;

const MEMBERS_SQL = `SELECT "businessId"::text AS "businessId", "storeId"::text AS "storeId", "productId"::text AS "productId"
  FROM "collections_member" WHERE "collectionId" = $1 ORDER BY "productId"`;
const FOREIGN_MEMBERS_SQL = `SELECT count(*)::int AS "count" FROM "collections_member"
  WHERE "businessId"::text <> $1 AND "productId"::text = ANY($2::text[])`;
/** The `collections-membership` deliveries of the `product.changed` events about a product (raw id). */
const DELIVERIES_SQL = `SELECT d.status FROM outbox_delivery d
  JOIN outbox_event e ON e.id = d."outboxId" AND e."createdAt" = d."createdAt"
  WHERE d.consumer = 'collections-membership' AND e.topic = 'product.changed' AND e."aggregateId" = $1`;

/** The attacker's rule: any of its own tag, the victim's tag or the victim's brand. */
const ruleNaming = (attacker: BusinessWorld, victim: BusinessWorld) => ({
  version: 1,
  match: 'any',
  conditions: [
    { field: 'tag', operator: 'is_any_of', values: [catalogOf(attacker).tag.id] },
    { field: 'tag', operator: 'is_any_of', values: [catalogOf(victim).tag.id] },
    { field: 'brand', operator: 'is_any_of', values: [catalogOf(victim).brand.id] },
  ],
});

interface ProductPage {
  readonly totalItems: number;
  readonly items: readonly { readonly title: string }[];
}

interface MemberRow {
  readonly businessId: string;
  readonly storeId: string;
  readonly productId: string;
}

const victimProductIds = (victim: BusinessWorld): string[] => [
  restIdOf(catalogOf(victim).product.id),
  restIdOf(collectionsOf(victim).secondProduct.id),
];

async function createStoredRuleCollection(http: IsolationHttp, [attacker, victim]: Pair): Promise<string> {
  const input = {
    title: `Stored rule ${attacker.businessId}`,
    slug: `stored-rule-${attacker.stores[0].id}`,
    visible: true,
    position: POSITION,
    mode: 'automatic',
    rule: ruleNaming(attacker, victim),
  };
  const answer = await http.graphql(attacker.owner, CREATE_STORE_COLLECTION, { input }, ownChannel(attacker));
  return (fieldOf(answer, 'createStoreCollection') as { id: string }).id;
}

/** Deletes the temporary collection, failing here (not in a later census) when the delete does not answer true. */
async function deleteCollection(http: IsolationHttp, attacker: BusinessWorld, id: string): Promise<void> {
  const answer = await http.graphql(attacker.owner, DELETE, { id }, ownChannel(attacker));
  if (fieldOf(answer, 'deleteStoreCollection') !== true) {
    throw new Error(`the stored-rule collection ${id} of ${attacker.label} was not deleted: ${JSON.stringify(answer)}`);
  }
}

/** Waits until the collection's page lists exactly the attacker's product, and answers it. */
function settledPage(http: IsolationHttp, attacker: BusinessWorld, id: string): Promise<ProductPage> {
  const wanted = JSON.stringify([catalogOf(attacker).product.title]);
  let last: ProductPage | undefined;
  const read = async (): Promise<ProductPage | undefined> => {
    const answer = await http.graphql(attacker.owner, PRODUCTS, { id }, ownChannel(attacker));
    last = fieldOf(answer, 'storeCollectionProducts') as ProductPage;
    return JSON.stringify(last.items.map((item) => item.title)) === wanted ? last : undefined;
  };
  return untilHolds("the stored-rule collection's members", read, SETTLE_WAIT_MS, () =>
    Promise.resolve(`(last page: ${JSON.stringify(last)})`),
  );
}

/**
 * The victim's owner re-sets its product's tag, so a `product.changed` of the victim's store reaches the
 * `collections-membership` consumer; waits until that delivery (one more than before) is done.
 */
async function retagVictimProduct(http: IsolationHttp, sql: MemberRowsRunner, victim: BusinessWorld): Promise<void> {
  const product = catalogOf(victim).product;
  const deliveries = async () => (await sql.query(DELIVERIES_SQL, [restIdOf(product.id)])) as { status: string }[];
  const before = (await deliveries()).length;
  const input = { tagIds: [catalogOf(victim).tag.id] };
  fieldOf(
    await http.graphql(victim.owner, RETAG, { id: product.id, input }, ownChannel(victim)),
    'updateCatalogProduct',
  );
  await untilHolds(
    `the membership delivery of ${victim.label}'s product edit`,
    async () => {
      const rows = await deliveries();
      return rows.length > before && rows.every((row) => row.status === 'done') ? rows : undefined;
    },
    SETTLE_WAIT_MS,
  );
}

/** The collection holds the attacker's product only, in the attacker's first store, and no victim product sits outside. */
async function expectOnlyOwnMembers(http: IsolationHttp, sql: MemberRowsRunner, [attacker, victim]: Pair, id: string) {
  const page = await settledPage(http, attacker, id);
  const members = (await sql.query(MEMBERS_SQL, [restIdOf(id)])) as MemberRow[];
  const foreign = (await sql.query(FOREIGN_MEMBERS_SQL, [victim.businessId, victimProductIds(victim)])) as {
    count: number;
  }[];

  const answer = JSON.stringify(page);
  const victimTitles = [catalogOf(victim).product.title, collectionsOf(victim).secondProduct.title];
  expect(victimTitles.filter((value) => answer.includes(value))).toEqual([]);
  expect(members).toEqual([
    {
      businessId: attacker.businessId,
      storeId: attacker.stores[0].id,
      productId: restIdOf(catalogOf(attacker).product.id),
    },
  ]);
  expect(foreign).toEqual([{ count: 0 }]);
}

/** Registers the stored-rule check in the calling `describe`, A against B and B against A. */
export function itKeepsStoredRulesInTheirStore({ world, http, sql }: StoredRuleHarness): void {
  const pairs = [
    { attacker: 'A', victim: 'B', of: (w: World): Pair => [w.a, w.b] },
    { attacker: 'B', victim: 'A', of: (w: World): Pair => [w.b, w.a] },
  ];
  it.each(pairs)(
    "fills $attacker's stored rule naming $victim's tag and brand with its own product only, after the save and a product.changed (D2307, D2336)",
    async ({ of }) => {
      const pair = of(world());
      const id = await createStoredRuleCollection(http, pair);
      try {
        await expectOnlyOwnMembers(http, sql(), pair, id);

        await retagVictimProduct(http, sql(), pair[1]);

        await expectOnlyOwnMembers(http, sql(), pair, id);
      } finally {
        await deleteCollection(http, pair[0], id);
      }
    },
    TEST_TIMEOUT_MS,
  );
}
