import { describe, expect, it } from 'vitest';
import { asOperationContext } from '../../application/ports/operation-context';
import type { ProductText } from '../../application/ports/product-polisher.port';
import { PolishProductService } from '../../application/polish-product.service';
import { AiDisabledError, ProductNotFoundError } from '../../domain/errors';
import { SCOPE } from '../support/scope';

const ctx = asOperationContext({});

/** A store with one product, its reads counted, behind a switch the test sets. */
const worldWith = (aiEnabled: boolean, products: ReadonlyMap<string, ProductText>) => {
  const reads: string[] = [];
  const service = new PolishProductService({
    ai: { isEnabled: () => Promise.resolve(aiEnabled) },
    products: {
      textOf: (_ctx, _scope, productId) => {
        reads.push(productId);
        return Promise.resolve(products.get(productId));
      },
    },
    polisher: { polish: (_scope, text) => Promise.resolve(text) },
  });
  return { reads, service };
};

const failureOf = (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => undefined,
    (error: unknown) => error,
  );

describe('PolishProductService (D2215, D2272)', () => {
  const products = new Map([['41', { title: 'Synthetic kaftan', description: '<p>Light</p>' }]]);

  it('with AI off answers ai-disabled without reading the product', async () => {
    // Arrange
    const { reads, service } = worldWith(false, products);

    // Act
    const failure = await failureOf(service.polish(ctx, SCOPE, '41'));

    // Assert
    expect(failure).toBeInstanceOf(AiDisabledError);
    expect(reads).toEqual([]);
  });

  it("answers product-not-found for a product the store can't read", async () => {
    // Arrange
    const { service } = worldWith(true, products);

    // Act
    const failure = await failureOf(service.polish(ctx, SCOPE, '99'));

    // Assert
    expect(failure).toBeInstanceOf(ProductNotFoundError);
  });

  it("answers the polisher's text with the product id", async () => {
    // Arrange
    const { service } = worldWith(true, products);

    // Act
    const polished = await service.polish(ctx, SCOPE, '41');

    // Assert
    expect(polished).toEqual({ productId: '41', title: 'Synthetic kaftan', description: '<p>Light</p>' });
  });
});
