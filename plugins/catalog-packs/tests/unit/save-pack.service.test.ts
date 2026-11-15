import { describe, expect, it } from 'vitest';
import { GetPackService } from '../../application/get-pack.service';
import { PreviewPackService } from '../../application/preview-pack.service';
import { SavePackService } from '../../application/save-pack.service';
import { ComponentNotFoundError, InvalidPackInputError, NotAPackError, PackNotFoundError } from '../../domain/errors';
import { aDefinition, aProduct, aSizedProduct } from '../support/builders';
import { CTX, packWorld, SCOPE_A, SCOPE_B } from '../fakes/pack-world';

function arranged() {
  const world = packWorld();
  world.catalog.put(
    SCOPE_A,
    aProduct({ id: '11', price: 1500, weight: 300 }),
    aProduct({ id: '12', price: 2000, weight: 500 }),
    aProduct({ id: '20', type: 'pack', price: 0 }),
  );
  return { ...world, saving: new SavePackService(world.ports), previewing: new PreviewPackService(world.ports) };
}

describe('SavePackService (D2202, D2203)', () => {
  it('stores the pack and writes the computed price and weight into the pack product', async () => {
    // Arrange
    const { catalog, packs, saving } = arranged();

    // Act
    const view = await saving.save(CTX, SCOPE_A, { productId: '20', definition: aDefinition() });

    // Assert
    expect(view).toMatchObject({ price: 3150, weightGrams: 800, pack: { productId: '20', status: 'ok' } });
    expect(catalog.writes).toEqual([{ productId: '20', price: 3150, weight: 800, sharedOption: null }]);
    expect(packs.all(SCOPE_A)).toHaveLength(1);
  });

  it('writes one variant per common value of a shared-option pack', async () => {
    // Arrange
    const { catalog, saving } = arranged();
    catalog.put(SCOPE_A, aSizedProduct('11', 'Size', ['S', 'M'], 1500), aSizedProduct('12', 'Size', ['M'], 2000));
    const definition = aDefinition({ packVariantMode: 'shared_option', packSharedOption: 'Size' });

    // Act
    await saving.save(CTX, SCOPE_A, { productId: '20', definition });

    // Assert
    expect(catalog.writes[0]?.sharedOption).toEqual({ name: 'Size', values: [{ value: 'M', price: 3150 }] });
  });

  it('writes nothing to the product when a second save computes the same values', async () => {
    // Arrange
    const { catalog, saving } = arranged();
    await saving.save(CTX, SCOPE_A, { productId: '20', definition: aDefinition() });

    // Act
    await saving.save(CTX, SCOPE_A, { productId: '20', definition: aDefinition() });

    // Assert
    expect(catalog.writes).toHaveLength(1);
  });

  it('stores the pack stale when a component is a draft', async () => {
    // Arrange
    const { catalog, saving } = arranged();
    catalog.put(SCOPE_A, aProduct({ id: '12', price: 2000, status: 'draft' }));

    // Act
    const view = await saving.save(CTX, SCOPE_A, { productId: '20', definition: aDefinition() });

    // Assert
    expect(view.pack.status).toBe('stale');
  });

  it('refuses a product that is not a pack', async () => {
    // Arrange
    const { saving } = arranged();

    // Act
    const save = saving.save(CTX, SCOPE_A, { productId: '11', definition: aDefinition() });

    // Assert
    await expect(save).rejects.toThrow(NotAPackError);
  });

  it("answers not found for another business's pack product and for a malformed id", async () => {
    // Arrange
    const { saving } = arranged();

    // Act
    const foreign = saving.save(CTX, SCOPE_B, { productId: '20', definition: aDefinition() });
    const malformed = saving.save(CTX, SCOPE_A, { productId: '07', definition: aDefinition() });

    // Assert
    await expect(foreign).rejects.toThrow(PackNotFoundError);
    await expect(malformed).rejects.toThrow(PackNotFoundError);
  });

  it('refuses a component of another business as not found and saves nothing', async () => {
    // Arrange
    const { catalog, packs, saving } = arranged();
    catalog.put(SCOPE_B, aProduct({ id: '30' }));
    const definition = aDefinition({
      components: [
        { productId: '11', variantId: null, quantity: 1 },
        { productId: '30', variantId: null, quantity: 1 },
      ],
    });

    // Act
    const save = saving.save(CTX, SCOPE_A, { productId: '20', definition });

    // Assert
    await expect(save).rejects.toThrow(ComponentNotFoundError);
    expect(packs.all(SCOPE_A)).toEqual([]);
  });

  it('refuses a computed price beyond an int column', async () => {
    // Arrange
    const { catalog, saving } = arranged();
    catalog.put(SCOPE_A, aProduct({ id: '11', price: 2_000_000_000 }), aProduct({ id: '12', price: 2_000_000_000 }));
    const definition = aDefinition({ packDiscountType: null, packDiscountValue: null });

    // Act
    const save = saving.save(CTX, SCOPE_A, { productId: '20', definition });

    // Assert
    await expect(save).rejects.toThrow(InvalidPackInputError);
  });

  it('saves a fixed pack whose components sum beyond an int column, since only written values must fit', async () => {
    // Arrange
    const { catalog, saving } = arranged();
    catalog.put(SCOPE_A, aProduct({ id: '11', price: 1_500_000_000 }), aProduct({ id: '12', price: 1_500_000_000 }));
    const definition = aDefinition({ packPricingMode: 'fixed', packFixedPrice: 100 });

    // Act
    const view = await saving.save(CTX, SCOPE_A, { productId: '20', definition });

    // Assert
    expect(view.price).toBe(100);
  });

  it('takes the pack lock, then plans the write from the product as stored once it is held (D2241)', async () => {
    // Arrange: a concurrent save commits other values while this save waits for the lock
    const { catalog, lock, saving } = arranged();
    await saving.save(CTX, SCOPE_A, { productId: '20', definition: aDefinition() });
    lock.onAcquire = () => {
      catalog.put(SCOPE_A, aProduct({ id: '20', type: 'pack', price: 9999, weight: 800 }));
    };

    // Act
    await saving.save(CTX, SCOPE_A, { productId: '20', definition: aDefinition() });

    // Assert
    expect(lock.acquired).toEqual(['20', '20']);
    expect(catalog.writes).toHaveLength(2);
    expect(catalog.get(SCOPE_A, '20')?.price).toBe(3150);
  });

  it('writes 0 g once into a pack product that holds no weight, so save and read agree (D2241)', async () => {
    // Arrange
    const { catalog, ports, saving } = arranged();
    catalog.put(SCOPE_A, aProduct({ id: '11', price: 1500 }), aProduct({ id: '12', price: 2000 }));
    catalog.put(SCOPE_A, aProduct({ id: '20', type: 'pack', price: 3150 }));
    const getting = new GetPackService(ports);

    // Act
    const view = await saving.save(CTX, SCOPE_A, { productId: '20', definition: aDefinition() });
    await saving.save(CTX, SCOPE_A, { productId: '20', definition: aDefinition() });

    // Assert
    expect(view.weightGrams).toBe(0);
    expect(catalog.writes.map((write) => write.weight)).toEqual([0]);
    expect((await getting.get(CTX, SCOPE_A, '20'))?.weightGrams).toBe(0);
  });

  it('writes a changed spelling of the shared option and its values (D2241)', async () => {
    // Arrange
    const { catalog, saving } = arranged();
    catalog.put(SCOPE_A, aSizedProduct('11', 'Size', ['m'], 1500), aSizedProduct('12', 'Size', ['m'], 2000));
    const definition = aDefinition({ packVariantMode: 'shared_option', packSharedOption: 'size' });
    await saving.save(CTX, SCOPE_A, { productId: '20', definition });
    catalog.put(SCOPE_A, aSizedProduct('11', 'Size', ['M'], 1500));

    // Act
    await saving.save(CTX, SCOPE_A, { productId: '20', definition: { ...definition, packSharedOption: 'Size' } });

    // Assert
    expect(catalog.writes[1]?.sharedOption).toEqual({ name: 'Size', values: [{ value: 'M', price: 3150 }] });
  });
});

describe('PreviewPackService and GetPackService', () => {
  it('previews without saving', async () => {
    // Arrange
    const { catalog, packs, previewing } = arranged();

    // Act
    const preview = await previewing.preview(CTX, SCOPE_A, aDefinition());

    // Assert
    expect(preview).toEqual({ price: 3150, weightGrams: 800, sharedValues: [] });
    expect(catalog.writes).toEqual([]);
    expect(packs.all(SCOPE_A)).toEqual([]);
  });

  it('reads a saved pack with the stored price, and nothing for another business', async () => {
    // Arrange
    const world = arranged();
    await world.saving.save(CTX, SCOPE_A, { productId: '20', definition: aDefinition() });
    const getting = new GetPackService(world.ports);

    // Act
    const own = await getting.get(CTX, SCOPE_A, '20');
    const foreign = await getting.get(CTX, SCOPE_B, '20');

    // Assert
    expect(own).toMatchObject({ price: 3150, weightGrams: 800, pack: { productId: '20' } });
    expect(foreign).toBeUndefined();
  });
});
