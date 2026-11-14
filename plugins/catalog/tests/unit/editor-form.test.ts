import { CATALOG_ERROR_CODES, MAX_PRODUCT_HIGHLIGHTS } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  editorFormErrors,
  editorFormOf,
  emptyEditorForm,
  hasOptionVariants,
  OPTION_VALUES_REQUIRED_MESSAGE_ID,
  submitEditor,
} from '../../dashboard/model/editor-form';
import { addGroup, removeValue } from '../../dashboard/model/options-draft';
import { savedRunner } from './editor-fixtures';

const highlightIds = (count: number): string[] =>
  Array.from({ length: count }, (_, i) => `70000000000000001${String(i).padStart(2, '0')}`);

describe('editor form', () => {
  it('refuses save with seven highlights before calling the server', async () => {
    // Arrange
    const form = { ...editorFormOf(savedRunner), highlightIds: highlightIds(MAX_PRODUCT_HIGHLIGHTS + 1) };
    const send = vi.fn(() => Promise.resolve('saved'));

    // Act
    const outcome = await submitEditor(form, send);

    // Assert
    expect(outcome).toEqual({
      kind: 'invalid',
      errors: { highlightIds: CATALOG_ERROR_CODES.TOO_MANY_HIGHLIGHTS },
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('sends a valid form and answers what the server answered', async () => {
    // Arrange
    const form = { ...editorFormOf(savedRunner), highlightIds: highlightIds(MAX_PRODUCT_HIGHLIGHTS) };
    const send = vi.fn(() => Promise.resolve('saved'));

    // Act
    const outcome = await submitEditor(form, send);

    // Assert
    expect(outcome).toEqual({ kind: 'sent', answer: 'saved' });
    expect(send).toHaveBeenCalledOnce();
  });

  it('names the fields a new product still needs and refuses money that is not whole dinars', () => {
    // Arrange
    const form = { ...emptyEditorForm(), title: '   ', price: '12.5', oldPrice: '-3' };

    // Act
    const errors = editorFormErrors(form);

    // Assert
    expect(errors).toEqual({
      title: 'catalog.error-title-required',
      price: 'catalog.error-whole-number',
      oldPrice: 'catalog.error-whole-number',
    });
  });

  it('refuses a variant price that is not a whole number', () => {
    // Arrange
    const saved = editorFormOf(savedRunner);
    const variants = saved.variants.map((row, index) => (index === 1 ? { ...row, price: 'abc' } : row));

    // Act
    const errors = editorFormErrors({ ...saved, variants });

    // Assert
    expect(errors).toEqual({ variants: 'catalog.error-whole-number' });
  });

  it('reads a saved product into text fields and back', () => {
    // Act
    const form = editorFormOf(savedRunner);

    // Assert
    expect(form.price).toBe('2500');
    expect(form.oldPrice).toBe('');
    expect(form.weight).toBe('300');
    expect(form.options).toEqual([
      { name: 'Color', values: ['Red', 'Blue'] },
      { name: 'Size', values: ['S', 'M'] },
    ]);
    expect(form.variants[0]).toEqual({
      id: '101',
      optionValues: ['Red', 'S'],
      sku: 'RUN-1',
      price: '2500',
      isHidden: false,
      featuredAssetId: null,
    });
    expect(editorFormErrors(form)).toEqual({});
  });

  it('refuses an option without values before calling the server', () => {
    // Arrange
    const saved = editorFormOf(savedRunner);
    const form = { ...saved, options: addGroup(saved.options, 'Material') };

    // Act
    const errors = editorFormErrors(form);

    // Assert
    expect(errors).toEqual({ options: OPTION_VALUES_REQUIRED_MESSAGE_ID });
  });

  it('refuses an option whose last value was removed', () => {
    // Arrange
    const saved = editorFormOf(savedRunner);
    const oneSize = removeValue(saved.options, 1, 1);
    const form = { ...saved, options: removeValue(oneSize, 1, 0) };

    // Act
    const errors = editorFormErrors(form);

    // Assert
    expect(errors.options).toBe(OPTION_VALUES_REQUIRED_MESSAGE_ID);
  });
});

describe('variants table visibility', () => {
  it('shows the variants of a product with options, even a single combination', () => {
    // Arrange
    const form = {
      ...editorFormOf(savedRunner),
      options: [{ name: 'Color', values: ['Red'] }],
      variants: [
        { id: '101', optionValues: ['Red'], sku: 'RUN-1', price: '2500', isHidden: false, featuredAssetId: null },
      ],
    };

    // Act
    const shown = hasOptionVariants(form);

    // Assert
    expect(shown).toBe(true);
  });

  it('hides the table for a product without options, whose one variant follows the product fields', () => {
    // Arrange
    const form = {
      ...emptyEditorForm(),
      variants: [{ id: '201', optionValues: [], sku: 'TEE', price: '900', isHidden: false, featuredAssetId: null }],
    };

    // Act
    const shown = hasOptionVariants(form);

    // Assert
    expect(shown).toBe(false);
  });
});
