import { CATALOG_ERROR_CODES, productInputSchema, productPatchSchema } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductService } from '../../application/create-product.service';
import { UpdateProductService } from '../../application/update-product.service';
import { type CoreId, toCoreId } from '../../domain/core-id';
import type { OperationContext } from '../../domain/ports/operation-context';
import type {
  CollectionMembershipSource,
  CollectionOption,
} from '../../domain/ports/collection-membership-source.port';
import type { StoreScope } from '../../domain/store-scope';
import { CollectionMembershipRegistry } from '../../infrastructure/collection-membership-registry';
import { InMemoryProductCollectionRepository } from '../fakes/in-memory-product-collection-repository';
import { storeContext } from '../fakes/in-memory-product-catalog';
import { ProductWorld } from '../fakes/product-world';
import { scopeA } from '../support/builders';

/** A source that keeps every link of its own, calls only `manual` collections manual, and logs each call. */
class RecordingSource implements CollectionMembershipSource {
  readonly calls: string[] = [];
  private readonly links = new Map<string, CoreId[]>();

  constructor(
    private readonly manual: readonly CoreId[] = [],
    private readonly options: readonly CollectionOption[] = [],
  ) {}

  replaceProductCollections(
    _ctx: OperationContext,
    _scope: StoreScope,
    productId: CoreId,
    ids: readonly CoreId[],
  ): Promise<void> {
    this.calls.push(`replace:${productId}`);
    this.links.set(productId, [...ids]);
    return Promise.resolve();
  }

  collectionIdsOf(_ctx: OperationContext, _scope: StoreScope, productId: CoreId): Promise<readonly CoreId[]> {
    this.calls.push(`of:${productId}`);
    return Promise.resolve(this.links.get(productId) ?? []);
  }

  productIdsInCollection(_ctx: OperationContext, _scope: StoreScope, collectionId: CoreId): Promise<readonly CoreId[]> {
    this.calls.push(`in:${collectionId}`);
    return Promise.resolve([]);
  }

  deleteProductLinks(_ctx: OperationContext, _scope: StoreScope, productId: CoreId): Promise<void> {
    this.calls.push(`delete:${productId}`);
    return Promise.resolve();
  }

  manualCollectionIdsAmong(
    _ctx: OperationContext,
    _scope: StoreScope,
    collectionIds: readonly CoreId[],
  ): Promise<readonly CoreId[]> {
    this.calls.push('manual');
    return Promise.resolve(collectionIds.filter((id) => this.manual.includes(id)));
  }

  collectionOptionsOf(): Promise<readonly CollectionOption[]> {
    this.calls.push('options');
    return Promise.resolve(this.options);
  }
}

const ctx = storeContext(scopeA.storeId);
const product = toCoreId('41');
const [first, second] = [toCoreId('7'), toCoreId('8')];

describe('CollectionMembershipRegistry (D2309)', () => {
  it('uses the table until a source registers', async () => {
    // Arrange
    const table = new InMemoryProductCollectionRepository();
    const registry = new CollectionMembershipRegistry(table);
    const source = new RecordingSource([first]);

    // Act
    await registry.replaceProductCollections(ctx, scopeA, product, [first, second]);
    const fromTable = await registry.collectionIdsOf(ctx, scopeA, product);
    const manualFromTable = await registry.manualCollectionIdsAmong(ctx, scopeA, [first, second]);
    registry.register(source);
    await registry.replaceProductCollections(ctx, scopeA, product, [first]);
    await registry.productIdsInCollection(ctx, scopeA, first);
    await registry.deleteProductLinks(ctx, scopeA, product);
    const manualFromSource = await registry.manualCollectionIdsAmong(ctx, scopeA, [first, second]);

    // Assert
    expect(fromTable).toEqual([first, second]);
    expect(manualFromTable).toEqual([first, second]);
    expect(manualFromSource).toEqual([first]);
    expect(table.links.map((link) => link.collectionId)).toEqual([first, second]);
    expect(source.calls).toEqual([`replace:${product}`, `in:${first}`, `delete:${product}`, 'manual']);
  });

  it('refuses a second registration', () => {
    // Arrange
    const registry = new CollectionMembershipRegistry(new InMemoryProductCollectionRepository());
    registry.register(new RecordingSource());

    // Act
    const registering = () => {
      registry.register(new RecordingSource());
    };

    // Assert
    expect(registering).toThrow(/already registered/);
  });

  it('default collection options are empty; a registered source answers them', async () => {
    // Arrange
    const registry = new CollectionMembershipRegistry(new InMemoryProductCollectionRepository());
    const options = [{ id: first, title: 'Summer' }];

    // Act
    const before = await registry.collectionOptionsOf(ctx, scopeA);
    registry.register(new RecordingSource([], options));
    const after = await registry.collectionOptionsOf(ctx, scopeA);

    // Assert
    expect(before).toEqual([]);
    expect(after).toEqual(options);
  });
});

describe('product writes and the registered source (D2309)', () => {
  let world: ProductWorld;

  beforeEach(() => {
    world = new ProductWorld();
  });

  const input = (collectionIds: readonly string[]) =>
    productInputSchema.parse({ title: 'Lamp', status: 'active', price: 1500, collectionIds });

  it('refuses a product write naming a collection the source does not call manual', async () => {
    // Arrange
    const manual = world.products.addCollection(scopeA.storeId);
    const automatic = world.products.addCollection(scopeA.storeId);
    world.membership.register(new RecordingSource([manual]));
    const creating = new CreateProductService(world.ports);

    // Act
    const refused = creating.create(world.ctxOf(scopeA), scopeA, input([manual, automatic]));

    // Assert
    await expect(refused).rejects.toMatchObject({ code: CATALOG_ERROR_CODES.COLLECTION_NOT_FOUND });
  });

  it('saves the manual collections through the registered source', async () => {
    // Arrange
    const manual = world.products.addCollection(scopeA.storeId);
    const source = new RecordingSource([manual]);
    world.membership.register(source);
    const { product: created } = await new CreateProductService(world.ports).create(
      world.ctxOf(scopeA),
      scopeA,
      input([]),
    );

    // Act
    await new UpdateProductService(world.ports).update(
      world.ctxOf(scopeA),
      scopeA,
      created.id,
      productPatchSchema.parse({ collectionIds: [manual] }),
    );

    // Assert
    expect(source.calls).toContain(`replace:${created.id}`);
    expect(world.collections.links).toEqual([]);
  });
});
