import { rawTestId } from '@cod/testing';
import { BULK_EDIT_RESULT_FIELDS } from './endpoint-registry';
import type { ImportSuite, ProductResult } from './import-kit';

const BULK_EDIT = `mutation ($input: CatalogBulkEditInput!) {
  bulkEditCatalogProducts(input: $input) { ${BULK_EDIT_RESULT_FIELDS} }
}`;

/** One product's line of a bulk-edit answer. */
export interface BulkResult {
  readonly productId: string;
  readonly ok: boolean;
  readonly changedFields: string[];
  readonly error: string | null;
}

/** The bulk-edit calls and reads the bulk-edit integration files share, on one suite. */
export interface BulkEditClient {
  readonly bulkEdit: (input: Record<string, unknown>) => Promise<BulkResult[]>;
  /** As A's owner, `count` products (active, priced 1 000 unless `input` says otherwise). */
  readonly productsOfA: (count: number, input?: Record<string, unknown>) => Promise<ProductResult[]>;
  readonly statusOf: (id: string) => Promise<string | undefined>;
  readonly activityCount: (id: string) => Promise<number>;
}

/** {@link BulkEditClient} over the suite's GraphQL client, as A's owner. */
export function bulkEditClient(suite: ImportSuite): BulkEditClient {
  return {
    bulkEdit: async (input) => {
      const answer = await suite.kit.gql<{ bulkEditCatalogProducts: { results: BulkResult[] } }>(BULK_EDIT, { input });
      return answer.bulkEditCatalogProducts.results;
    },
    productsOfA: async (count, input = {}) => {
      await suite.kit.asOwner(suite.fixtures.a);
      const products: ProductResult[] = [];
      for (let index = 0; index < count; index += 1) products.push(await suite.kit.createProduct(input));
      return products;
    },
    statusOf: async (id) => {
      return (await suite.kit.product(id))?.status;
    },
    activityCount: async (id) => {
      return (await suite.kit.activityOf(rawTestId(id))).length;
    },
  };
}
