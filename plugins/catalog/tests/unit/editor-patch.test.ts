import { productInputSchema, productPatchSchema } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { editorFormOf, emptyEditorForm } from '../../dashboard/model/editor-form';
import { createInputOf, isEmptyPatch, patchOf } from '../../dashboard/model/editor-patch';
import { addValue, removeValue } from '../../dashboard/model/options-draft';
import { savedRunner } from './editor-fixtures';

const saved = editorFormOf(savedRunner);

describe('editor patch', () => {
  it('sends only changed fields', () => {
    // Arrange
    const form = {
      ...saved,
      title: 'Trail runner',
      oldPrice: '3000',
      settings: { ...saved.settings, isFragile: true },
    };

    // Act
    const patch = patchOf(saved, form);

    // Assert
    expect(patch).toEqual({ title: 'Trail runner', oldPrice: 3000, settings: { isFragile: true } });
    expect(productPatchSchema.safeParse(patch).success).toBe(true);
    expect(isEmptyPatch(patchOf(saved, saved))).toBe(true);
  });

  it('clears an optional field with null', () => {
    // Arrange
    const form = { ...saved, weight: '', description: '' };

    // Act
    const patch = patchOf(saved, form);

    // Assert
    expect(patch).toEqual({ weight: null, description: null });
  });

  it('sends variant edits by id', () => {
    // Arrange
    const variants = saved.variants.map((row) => (row.id === '102' ? { ...row, price: '3100', isHidden: true } : row));

    // Act
    const patch = patchOf(saved, { ...saved, variants });

    // Assert
    expect(patch).toEqual({ variants: [{ id: '102', price: 3100, isHidden: true }] });
    expect(productPatchSchema.safeParse(patch).success).toBe(true);
  });

  it('sends the options whole and drops edits of variants whose combination is removed', () => {
    // Arrange
    const options = removeValue(addValue(saved.options, 0, 'Green'), 1, 1);
    const variants = saved.variants.map((row) => ({ ...row, sku: `${row.sku}-X` }));

    // Act
    const patch = patchOf(saved, { ...saved, options, variants });

    // Assert
    expect(patch.optionGroups).toEqual([
      { name: 'Color', values: ['Red', 'Blue', 'Green'] },
      { name: 'Size', values: ['S'] },
    ]);
    expect(patch.variants).toEqual([
      { id: '101', sku: 'RUN-1-X' },
      { id: '103', sku: 'RUN-3-X' },
    ]);
  });

  it('builds a create input the shared schema accepts, with the options and full settings', () => {
    // Arrange
    const form = {
      ...emptyEditorForm(),
      title: 'Runner',
      price: '2500',
      sku: 'RUN',
      options: [
        { name: 'Color', values: ['Red', 'Blue'] },
        { name: 'Size', values: ['S', 'M'] },
      ],
    };

    // Act
    const input = createInputOf(form);

    // Assert
    expect(input).toMatchObject({ title: 'Runner', price: 2500, sku: 'RUN', status: 'active' });
    expect(input.optionGroups).toHaveLength(2);
    expect(input).not.toHaveProperty('slug');
    expect(productInputSchema.safeParse(input).success).toBe(true);
  });

  it.each(['<p></p>', '<p> </p>', '<p><br></p>', '<p>&nbsp;</p>'])(
    'clears a description the rich-text editor left as empty markup %s',
    (description) => {
      // Arrange
      const form = { ...saved, description };

      // Act
      const patch = patchOf(saved, form);

      // Assert
      expect(patch).toEqual({ description: null });
      expect(createInputOf(form).description).toBeNull();
    },
  );

  it('keeps a description that has text', () => {
    // Arrange
    const form = { ...saved, description: '<p><strong>Light</strong> and fast</p>' };

    // Act
    const patch = patchOf(saved, form);

    // Assert
    expect(patch).toEqual({ description: '<p><strong>Light</strong> and fast</p>' });
  });
});
