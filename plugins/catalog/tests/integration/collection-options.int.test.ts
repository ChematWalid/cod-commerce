import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  type CatalogCollectionOption,
  COLLECTION_MEMBERSHIP_SOURCE_REGISTRAR,
  type CollectionMembershipSourceRegistrar,
  toCoreId,
} from '../../index';
import { StoreKeyedCollectionSource } from '../fakes/store-keyed-collection-source';
import { rawId } from './catalog-kit';
import { factsSuite } from './facts-kit';

const suite = factsSuite(1021, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

const OPTIONS = /* GraphQL */ `
  query CollectionOptions {
    catalogCollectionOptions {
      id
      title
    }
  }
`;

let source: StoreKeyedCollectionSource;

/** The options the signed-in caller's active store gets, with database ids. */
async function optionsOfCaller(): Promise<CatalogCollectionOption[]> {
  const { catalogCollectionOptions } = await suite.kit.gql<{ catalogCollectionOptions: CatalogCollectionOption[] }>(
    OPTIONS,
  );
  return catalogCollectionOptions.map(({ id, title }) => ({ id: toCoreId(rawId(id)), title }));
}

describe('catalogCollectionOptions with a registered membership source (D2309, D2324)', () => {
  beforeAll(() => {
    // Stands in for collections-rules: one option per store of A1 and B, none for A2.
    const { a, b } = suite.fixtures;
    source = new StoreKeyedCollectionSource(
      new Map([
        [a.stores[0].id, [{ id: toCoreId('9101'), title: 'A1 summer' }]],
        [b.stores[0].id, [{ id: toCoreId('9201'), title: 'B summer' }]],
      ]),
    );
    suite.app
      .get<unknown, CollectionMembershipSourceRegistrar>(COLLECTION_MEMBERSHIP_SOURCE_REGISTRAR)
      .register(source);
  });

  it("answers only the caller's own store options: A1, A2 and B never see each other's", async () => {
    // Arrange
    const { a, b } = suite.fixtures;

    // Act
    await suite.kit.asOwner(a);
    const ofA1 = await optionsOfCaller();
    await suite.kit.asOwner(a, a.stores[1]);
    const ofA2 = await optionsOfCaller();
    await suite.kit.asOwner(b);
    const ofB = await optionsOfCaller();

    // Assert
    expect(ofA1).toEqual([{ id: '9101', title: 'A1 summer' }]);
    expect(ofA2).toEqual([]);
    expect(ofB).toEqual([{ id: '9201', title: 'B summer' }]);
    expect(source.optionScopes.map((scope) => scope.storeId)).toEqual([a.stores[0].id, a.stores[1].id, b.stores[0].id]);
  });
});
