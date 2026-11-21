import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { describe, expect, it } from 'vitest';
import { packInput, packsSuite, SAVE_PACK } from './packs-kit';

const suite = packsSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

describe('pack rows stay with their business and store (ADR 0002)', () => {
  it("stores A's pack and its components under A's business and active store only", async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);
    const one = await suite.kit.createProduct({ title: 'One', price: 10 });
    const two = await suite.kit.createProduct({ title: 'Two', price: 20 });
    const pack = await suite.kit.createPackProduct();

    // Act
    await suite.kit.gql(SAVE_PACK, { id: pack.id, input: packInput([one.id, two.id]) });

    // Assert
    const packs = await suite.kit.query<{ businessId: string; storeId: string }>(
      'SELECT "businessId", "storeId" FROM catalog_pack',
    );
    const lines = await suite.kit.query<{ businessId: string; storeId: string }>(
      'SELECT "businessId", "storeId" FROM catalog_pack_component',
    );
    expect(packs).toEqual([{ businessId: a.businessId, storeId: a.stores[1].id }]);
    expect(lines).toEqual([
      { businessId: a.businessId, storeId: a.stores[1].id },
      { businessId: a.businessId, storeId: a.stores[1].id },
    ]);
  });
});
