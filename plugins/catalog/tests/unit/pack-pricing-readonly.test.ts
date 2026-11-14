import { productInputSchema, productPatchSchema } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { editorFormOf, emptyEditorForm } from '../../dashboard/model/editor-form';
import { pricingReadOnly } from '../../dashboard/model/editor-pack';
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
    expect(pricingReadOnly(form, false)).toBe(true);
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
    expect(pricingReadOnly(editorFormOf(savedRunner), false)).toBe(false);
    expect(pricingReadOnly(editorFormOf(savedRunner), true)).toBe(true);
  });
});
