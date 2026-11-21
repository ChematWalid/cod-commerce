import { describe, expect, it } from 'vitest';
import type { CatalogProductDto, CatalogVariantDto } from '../../dashboard/dto';
import { type EditorForm, editorFormOf, type VariantDraft } from '../../dashboard/model/editor-form';
import { packRefreshOf } from '../../dashboard/model/editor-refresh';
import { savedRunner } from './editor-fixtures';

/** The pack's one default variant at the placeholder price. */
const defaultVariant: CatalogVariantDto = {
  id: '201',
  name: 'Duo',
  sku: 'DUO',
  price: 0,
  oldPrice: null,
  barcode: null,
  isHidden: false,
  optionValues: [],
  featuredAsset: null,
};

/** A pack at the placeholder price 0 with one default variant, as the editor opened it. */
const openedPack: CatalogProductDto = {
  ...savedRunner,
  type: 'pack',
  price: 0,
  weight: null,
  optionGroups: [],
  variants: [defaultVariant],
};

/** The same pack after catalog-packs composed it in shared_option mode: new price, weight, options and variants. */
const composedPack: CatalogProductDto = {
  ...openedPack,
  price: 3150,
  oldPrice: 3500,
  weight: 450,
  optionGroups: [{ id: '9', name: 'Size', values: [{ id: '91', name: 'M' }] }],
  variants: [{ ...defaultVariant, id: '301', optionValues: ['M'], price: 3150, sku: '' }],
};

const stateOf = (product: CatalogProductDto) => ({ form: editorFormOf(product), saved: editorFormOf(product) });

describe('pack refresh of the product editor', () => {
  it('takes the computed price, weight, options and variants into both the form and what was saved', () => {
    // Arrange
    const current = stateOf(openedPack);

    // Act
    const next = packRefreshOf(current, editorFormOf(composedPack));

    // Assert
    expect(next?.form.price).toBe('3150');
    expect(next?.saved.price).toBe('3150');
    expect(next?.form.oldPrice).toBe('3500');
    expect(next?.form.weight).toBe('450');
    expect(next?.saved.options).toEqual([{ name: 'Size', values: ['M'] }]);
    expect(next?.form.variants.map((row) => row.id)).toEqual(['301']);
    expect(next?.saved.variants.map((row) => row.id)).toEqual(['301']);
  });

  it('keeps the merchant unsaved edits of fields the pack does not compute', () => {
    // Arrange
    const opened = stateOf(openedPack);
    const current = { ...opened, form: { ...opened.form, title: 'Duo summer', sku: 'DUO-1' } };

    // Act
    const next = packRefreshOf(current, editorFormOf(composedPack));

    // Assert
    expect(next?.form.title).toBe('Duo summer');
    expect(next?.form.sku).toBe('DUO-1');
    expect(next?.saved.title).toBe(openedPack.title);
  });

  it('keeps an unsaved SKU, hidden or image edit of a variant that is still there, at its new price', () => {
    // Arrange
    const repriced: CatalogProductDto = {
      ...openedPack,
      price: 3150,
      variants: [{ ...defaultVariant, price: 3150 }],
    };
    const opened = stateOf(openedPack);
    const editedRow: VariantDraft = {
      id: '201',
      optionValues: [],
      sku: 'DUO-X',
      price: '0',
      isHidden: true,
      featuredAssetId: '7',
    };
    const current = { ...opened, form: { ...opened.form, variants: [editedRow] } };

    // Act
    const next = packRefreshOf(current, editorFormOf(repriced));

    // Assert
    expect(next?.form.variants).toEqual([{ ...editedRow, price: '3150' }]);
    expect(next?.saved.variants).toEqual(editorFormOf(repriced).variants);
  });

  it('changes nothing when the fresh read computes the same values', () => {
    // Arrange
    const opened = stateOf(openedPack);
    const current = { ...opened, form: { ...opened.form, title: 'Duo summer' } };
    const fresh: EditorForm = { ...editorFormOf(openedPack), title: 'Renamed elsewhere' };

    // Act
    const next = packRefreshOf(current, fresh);

    // Assert
    expect(next).toBeNull();
  });

  it('leaves a product that is not a pack to the editor as it is', () => {
    // Arrange
    const current = stateOf(savedRunner);

    // Act
    const next = packRefreshOf(current, editorFormOf({ ...savedRunner, price: 9999 }));

    // Assert
    expect(next).toBeNull();
  });
});
