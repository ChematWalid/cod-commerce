import { expect, it } from 'vitest';
import { catalogOf } from '../catalog-world';
import { collectionsOf } from '../collections-world';
import { fieldOf, type IsolationHttp } from '../http';
import { ownChannel } from '../matrix';
import { CREATE_STORE_COLLECTION } from '../seed-operations';
import type { World } from '../world';
import type { BusinessWorld } from '../world-types';

/**
 * A stored rule of A naming B's tag and brand (D2307), through the save and the recompute that write
 * `collections_member` (D2334, D2336), not the preview: A's collection holds A's matching product only, and every
 * member row carries A's business and store. Outside the matrix, since A's own answer echoes B's ids in its rule,
 * which the leak scanner cannot tell from a leak; the collection is deleted after, so the snapshots stay as they were.
 */

/** What runs the raw member query. */
export interface MemberRowsRunner {
  query(sql: string, parameters: unknown[]): Promise<unknown>;
}

/** What the stored-rule check needs from the suite. */
export interface StoredRuleHarness {
  readonly world: () => World;
  readonly http: IsolationHttp;
  readonly sql: () => MemberRowsRunner;
}

const SETTLE_WAIT_MS = 30_000;
const SETTLE_POLL_MS = 500;
const POSITION = 9;

const PRODUCTS = 'query ($id: ID!) { storeCollectionProducts(id: $id) { totalItems items { productId title } } }';
const DELETE = 'mutation ($id: ID!) { deleteStoreCollection(id: $id) }';

/** A's rule: any of A's tag, B's tag or B's brand. */
const ruleNaming = (a: BusinessWorld, b: BusinessWorld) => ({
  version: 1,
  match: 'any',
  conditions: [
    { field: 'tag', operator: 'is_any_of', values: [catalogOf(a).tag.id] },
    { field: 'tag', operator: 'is_any_of', values: [catalogOf(b).tag.id] },
    { field: 'brand', operator: 'is_any_of', values: [catalogOf(b).brand.id] },
  ],
});

interface ProductPage {
  readonly totalItems: number;
  readonly items: readonly { readonly title: string }[];
}

/** Registers the stored-rule check in the calling `describe`. */
export function itKeepsStoredRulesInTheirStore({ world, http, sql }: StoredRuleHarness): void {
  it("fills A's stored rule naming B's tag and brand with A's product only, in A's store (D2307)", async () => {
    const { a, b } = world();
    const products = async (id: string): Promise<ProductPage> =>
      fieldOf(await http.graphql(a.owner, PRODUCTS, { id }, ownChannel(a)), 'storeCollectionProducts') as ProductPage;
    const created = fieldOf(
      await http.graphql(
        a.owner,
        CREATE_STORE_COLLECTION,
        {
          input: {
            title: `Stored rule ${a.businessId}`,
            slug: `stored-rule-${a.stores[0].id}`,
            visible: true,
            position: POSITION,
            mode: 'automatic',
            rule: ruleNaming(a, b),
          },
        },
        ownChannel(a),
      ),
      'createStoreCollection',
    ) as { id: string };
    try {
      const wanted = [catalogOf(a).product.title];
      const deadline = Date.now() + SETTLE_WAIT_MS;
      let page = await products(created.id);
      while (JSON.stringify(page.items.map((item) => item.title)) !== JSON.stringify(wanted) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, SETTLE_POLL_MS));
        page = await products(created.id);
      }
      const rows = await sql().query(
        'SELECT DISTINCT "businessId", "storeId" FROM "collections_member" WHERE "collectionId" = $1',
        [created.id.replace(/^T_/, '')],
      );

      expect(page.items.map((item) => item.title)).toEqual(wanted);
      const answer = JSON.stringify(page);
      const foreign = [catalogOf(b).product.title, collectionsOf(b).secondProduct.title];
      expect(foreign.filter((value) => answer.includes(value))).toEqual([]);
      expect(rows).toEqual([{ businessId: a.businessId, storeId: a.stores[0].id }]);
    } finally {
      await http.graphql(a.owner, DELETE, { id: created.id }, ownChannel(a));
    }
  });
}
