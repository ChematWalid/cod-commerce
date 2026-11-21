import { productInputSchema, productPatchSchema } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { type EditorField, editorFormErrors, editorFormOf, emptyEditorForm } from '../../dashboard/model/editor-form';
import { packFieldReadOnly } from '../../dashboard/model/editor-pack';
import { createInputOf, patchOf } from '../../dashboard/model/editor-patch';
import { savedRunner } from './editor-fixtures';

const savedPack = editorFormOf({ ...savedRunner, type: 'pack', oldPrice: null });

describe('pack pricing in the product editor (D2201 c, D2227)', () => {
  it('the editor patch for type `pack` holds no variant prices and the pricing section is read-only', () => {
    // Arrange
    const [first, ...rest] = savedPack.variants;
    const form = {
      ...savedPack,
      title: 'Summer pack',
      price: '9999',
      oldPrice: '12000',
      weight: '5',
      variants: first === undefined ? [] : [{ ...first, price: '1', sku: 'PACK-RED-S' }, ...rest],
    };

    // Act
    const patch = patchOf(savedPack, form);

    // Assert
    expect(patch).toEqual({ title: 'Summer pack', variants: [{ id: first?.id, sku: 'PACK-RED-S' }] });
    expect(productPatchSchema.safeParse(patch).success).toBe(true);
    expect(packFieldReadOnly(form, 'price', false)).toBe(true);
  });

  it('an editor save after a pack save keeps the pack price', () => {
    // Arrange
    const form = { ...savedPack, price: '1', options: [] };

    // Act
    const patch = patchOf(savedPack, form);

    // Assert
    expect(patch).toEqual({});
  });

  it('never sends the type in a patch', () => {
    // Act
    const patch = patchOf(editorFormOf(savedRunner), { ...editorFormOf(savedRunner), type: 'pack' });

    // Assert
    expect(patch).toEqual({});
  });

  it('creates a pack bare: no options, weight or old price', () => {
    // Arrange
    const form = {
      ...emptyEditorForm(),
      type: 'pack' as const,
      title: 'Pack',
      price: '100',
      oldPrice: '200',
      weight: '300',
      options: [{ name: 'Size', values: ['S'] }],
    };

    // Act
    const input = createInputOf(form);

    // Assert
    expect(input).toMatchObject({ type: 'pack', optionGroups: [], weight: null, oldPrice: null });
    expect(productInputSchema.safeParse(input).success).toBe(true);
  });

  it('keeps the pricing section editable for a physical product the caller may save', () => {
    // Assert
    expect(packFieldReadOnly(editorFormOf(savedRunner), 'price', false)).toBe(false);
    expect(packFieldReadOnly(editorFormOf(savedRunner), 'price', true)).toBe(true);
  });

  it('a new pack with an empty price has no form errors and a valid create input with a placeholder price', () => {
    // Arrange
    const form = { ...emptyEditorForm(), title: 'P', type: 'pack' as const };

    // Act
    const errors = editorFormErrors(form);
    const input = createInputOf(form);

    // Assert
    expect(errors).toEqual({});
    expect(input.price).toBe(0);
    expect(productInputSchema.safeParse(input).success).toBe(true);
  });

  it('leaves the price, old price, weight, options and variant prices of a pack unchecked', () => {
    // Arrange
    const [first, ...rest] = savedPack.variants;
    const form = {
      ...savedPack,
      price: 'x',
      oldPrice: 'x',
      weight: 'x',
      options: [{ name: 'Size', values: [] }],
      variants: first === undefined ? [] : [{ ...first, price: 'x' }, ...rest],
    };

    // Act
    const errors = editorFormErrors(form);

    // Assert
    expect(errors).toEqual({});
    expect(editorFormErrors({ ...form, type: 'physical' })).toMatchObject({ price: expect.any(String) as unknown });
  });

  it("makes a pack's price, old price, weight, options and variant prices read-only, but not its SKU or barcode", () => {
    // Act
    const readOnly = (fields: readonly EditorField[]) =>
      fields.map((field) => packFieldReadOnly(savedPack, field, false));

    // Assert
    expect(readOnly(['price', 'oldPrice', 'weight', 'options', 'variants'])).toEqual([true, true, true, true, true]);
    expect(readOnly(['sku', 'barcode', 'width'])).toEqual([false, false, false]);
  });
});
