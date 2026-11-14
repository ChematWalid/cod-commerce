import { productInputSchema } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductService } from '../../application/create-product.service';
import { MediaLibraryService } from '../../application/media-library.service';
import { UpdateProductService } from '../../application/update-product.service';
import { MediaNotFoundError } from '../../domain/errors';
import { ProductWorld } from '../fakes/product-world';
import { scopeA } from '../support/builders';

const PNG = Uint8Array.from({ length: 64 }, (_, i) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][i] ?? 0);

describe('product saves and media deletes stay apart (D2128)', () => {
  let world: ProductWorld;
  let media: MediaLibraryService;

  beforeEach(() => {
    world = new ProductWorld();
    media = new MediaLibraryService(world.ports);
    // Logged with the lock calls, so a test sees the lock came before the in-use check and the removal.
    const remove = world.storage.remove.bind(world.storage);
    world.storage.remove = (ctx, assetId) => {
      world.products.calls.push(`remove:${assetId}`);
      return remove(ctx, assetId);
    };
  });

  const upload = () => media.upload(world.ctxOf(scopeA), scopeA, PNG);
  const create = (input: Record<string, unknown>) =>
    new CreateProductService(world.ports).create(
      world.ctxOf(scopeA),
      scopeA,
      productInputSchema.parse({ title: 'Shirt', status: 'active', price: 2500, ...input }),
    );

  it("deleting media takes its asset's exclusive lock inside the transaction, before the in-use check", async () => {
    // Arrange
    const item = await upload();
    world.products.calls.length = 0;

    // Act
    await media.delete(world.ctxOf(scopeA), scopeA, item.id);

    // Assert
    expect(world.products.calls).toEqual([`media-exclusive:${item.assetId}`, `remove:${item.assetId}`]);
    expect(world.locksOutsideTransaction).toBe(0);
  });

  it('a create shares the lock of every image it names before it checks them', async () => {
    // Arrange
    const [featured, gallery] = [await upload(), await upload()];
    world.products.calls.length = 0;

    // Act
    await create({ featuredAssetId: featured.assetId, assetIds: [gallery.assetId, featured.assetId] });

    // Assert
    expect(world.products.calls[0]).toBe(`media-share:${[featured.assetId, gallery.assetId].sort().join(',')}`);
    expect(world.locksOutsideTransaction).toBe(0);
  });

  it('an update shares the lock of its images after the taxonomy locks and before the product lock', async () => {
    // Arrange
    const { product } = await create({});
    const image = await upload();
    world.products.calls.length = 0;

    // Act
    await new UpdateProductService(world.ports).update(world.ctxOf(scopeA), scopeA, product.id, {
      featuredAssetId: image.assetId,
    });

    // Assert
    expect(world.products.calls.slice(0, 2)).toEqual([`media-share:${image.assetId}`, `lock:${product.id}`]);
    expect(world.locksOutsideTransaction).toBe(0);
  });

  it('locks no malformed image id and still answers not found for it', async () => {
    // Arrange
    world.products.calls.length = 0;

    // Act
    const saving = create({ featuredAssetId: 'abc' });

    // Assert
    await expect(saving).rejects.toBeInstanceOf(MediaNotFoundError);
    expect(world.products.calls.filter((call) => call.startsWith('media-share:'))).toEqual([]);
  });
});
