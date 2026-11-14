import { describe, expect, it } from 'vitest';
import type { ProductCollectionRepositoryPort } from '../../domain/ports/product-collection-repository.port';
import { newCoreId, scopeA, scopeA2, scopeB } from '../support/builders';
import type { MakeHarness } from './repository-harness';

/** The behaviour every {@link ProductCollectionRepositoryPort} adapter must have, isolation included. */
export function describeProductCollectionRepositoryContract(
  name: string,
  make: MakeHarness<ProductCollectionRepositoryPort>,
): void {
  describe(`${name} (ProductCollectionRepositoryPort contract)`, () => {
    it("replaces a product's collection links, keeping the given order and dropping repeats", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [first, second, third] = [newCoreId(), newCoreId(), newCoreId()];
      const productId = newCoreId();
      await repo.replaceProductCollections(ctx, scopeA, productId, [first, second]);

      // Act
      await repo.replaceProductCollections(ctx, scopeA, productId, [third, first, third]);

      // Assert
      expect(await repo.collectionIdsOf(ctx, scopeA, productId)).toEqual([third, first]);
    });

    it("finds a collection's products in its store only", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const collectionId = newCoreId();
      const [own, otherStore, otherBusiness] = [newCoreId(), newCoreId(), newCoreId()];
      await repo.replaceProductCollections(ctx, scopeA, own, [collectionId]);
      await repo.replaceProductCollections(ctx, scopeA2, otherStore, [collectionId]);
      await repo.replaceProductCollections(ctx, scopeB, otherBusiness, [collectionId]);

      // Act
      const found = await repo.productIdsInCollection(ctx, scopeA, collectionId);

      // Assert
      expect(found).toEqual([own]);
    });

    it("never reads or clears another store's links of the same product id", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const productId = newCoreId();
      const collectionId = newCoreId();
      await repo.replaceProductCollections(ctx, scopeB, productId, [collectionId]);

      // Act
      await repo.deleteProductLinks(ctx, scopeA, productId);
      await repo.replaceProductCollections(ctx, scopeA2, productId, []);

      // Assert
      expect(await repo.collectionIdsOf(ctx, scopeA, productId)).toEqual([]);
      expect(await repo.collectionIdsOf(ctx, scopeB, productId)).toEqual([collectionId]);
    });

    it('deletes every link of a product', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const productId = newCoreId();
      await repo.replaceProductCollections(ctx, scopeA, productId, [newCoreId(), newCoreId()]);

      // Act
      await repo.deleteProductLinks(ctx, scopeA, productId);

      // Assert
      expect(await repo.collectionIdsOf(ctx, scopeA, productId)).toEqual([]);
    });
  });
}
