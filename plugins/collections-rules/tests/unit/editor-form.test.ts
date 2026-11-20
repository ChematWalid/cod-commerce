import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { StoreCollectionDto, StoreCollectionRuleDto } from '../../dashboard/dto';
import {
  type CollectionForm,
  collectionFormErrors,
  collectionFormOf,
  createInputOf,
  emptyCollectionForm,
  fieldErrorsOfCode,
  needsModeConfirmation,
  productIdsToSet,
  updateInputOf,
} from '../../dashboard/model/editor-form';
import type { ManualProduct } from '../../dashboard/model/manual-order';

const TAG_ID = '7301234567890123456';
const RULE: StoreCollectionRuleDto = {
  version: 1,
  match: 'all',
  conditions: [{ field: 'tag', operator: 'is_any_of', values: [TAG_ID] }],
};

const product = (productId: string): ManualProduct => ({
  productId,
  title: `T ${productId}`,
  status: 'active',
  price: 1,
});

const SAVED_MANUAL: StoreCollectionDto = {
  id: '41',
  title: 'Summer',
  slug: 'summer',
  description: null,
  featuredAsset: null,
  mode: 'manual',
  rule: null,
  visible: true,
  position: 3,
  productCount: 2,
};

const filled = (change: Partial<CollectionForm>): CollectionForm => ({
  ...emptyCollectionForm(),
  title: 'Summer',
  ...change,
});

describe('collection editor form', () => {
  it('builds the create input in manual mode without a rule', () => {
    // Arrange
    const form = filled({ mode: 'manual', rule: RULE, position: '4', products: [product('1')] });

    // Act
    const input = createInputOf(form);

    // Assert
    expect(input).toEqual({ title: 'Summer', visible: true, position: 4, mode: 'manual' });
    expect(input).not.toHaveProperty('rule');
  });

  it('keeps the rule only in automatic mode', () => {
    // Arrange
    const automatic = filled({ mode: 'automatic', rule: RULE });
    const saved = collectionFormOf(SAVED_MANUAL, [product('1')]);

    // Act
    const created = createInputOf(automatic);
    const switched = updateInputOf(saved, { ...saved, mode: 'automatic', rule: RULE });
    const backToManual = updateInputOf({ ...saved, mode: 'automatic', rule: RULE }, { ...saved, rule: RULE });

    // Assert
    expect(created.rule).toEqual(RULE);
    expect(switched).toEqual({ mode: 'automatic', rule: RULE });
    expect(backToManual).toEqual({ mode: 'manual' });
  });

  it('a manual → automatic save needs confirmation, automatic → manual does not', () => {
    // Arrange
    const manual = collectionFormOf(SAVED_MANUAL, [product('1')]);
    const automatic: CollectionForm = { ...manual, mode: 'automatic', rule: RULE };

    // Act
    const toAutomatic = needsModeConfirmation(manual, automatic);
    const toManual = needsModeConfirmation(automatic, manual);
    const newAutomatic = needsModeConfirmation(null, automatic);

    // Assert
    expect(toAutomatic).toBe(true);
    expect(toManual).toBe(false);
    expect(newAutomatic).toBe(false);
  });

  it('maps server codes to field errors', () => {
    // Act
    const slug = fieldErrorsOfCode(COLLECTIONS_ERROR_CODES.SLUG_TAKEN);
    const image = fieldErrorsOfCode(COLLECTIONS_ERROR_CODES.IMAGE_NOT_FOUND);
    const products = fieldErrorsOfCode(COLLECTIONS_ERROR_CODES.TOO_MANY_PRODUCTS);
    const rule = fieldErrorsOfCode(COLLECTIONS_ERROR_CODES.RULE_INVALID);
    const other = fieldErrorsOfCode('FORBIDDEN');

    // Assert
    expect(slug).toEqual({ slug: COLLECTIONS_ERROR_CODES.SLUG_TAKEN });
    expect(image).toEqual({ featuredAssetId: COLLECTIONS_ERROR_CODES.IMAGE_NOT_FOUND });
    expect(products).toEqual({ products: COLLECTIONS_ERROR_CODES.TOO_MANY_PRODUCTS });
    expect(rule).toEqual({ rule: COLLECTIONS_ERROR_CODES.RULE_INVALID });
    expect(other).toEqual({});
  });

  it('refuses a blank title, a position out of range and an automatic collection without a rule', () => {
    // Arrange
    const form = filled({ title: '  ', position: '10000', mode: 'automatic', rule: null });

    // Act
    const errors = collectionFormErrors(form);

    // Assert
    expect(Object.keys(errors).sort()).toEqual(['position', 'rule', 'title']);
  });

  it('sends only what changed, and null to clear the description or the image', () => {
    // Arrange
    const saved = { ...collectionFormOf(SAVED_MANUAL, []), description: '<p>Hi</p>', featuredAssetId: '9' };

    // Act
    const patch = updateInputOf(saved, { ...saved, title: 'Winter', description: '', featuredAssetId: null });

    // Assert
    expect(patch).toEqual({ title: 'Winter', description: null, featuredAssetId: null });
  });

  it('sets the products of a manual collection only when their order changed', () => {
    // Arrange
    const saved = collectionFormOf(SAVED_MANUAL, [product('1'), product('2')]);

    // Act
    const unchanged = productIdsToSet(saved, saved);
    const reordered = productIdsToSet(saved, { ...saved, products: [product('2'), product('1')] });
    const created = productIdsToSet(null, saved);
    const automatic = productIdsToSet(null, { ...saved, mode: 'automatic', rule: RULE });

    // Assert
    expect(unchanged).toBeNull();
    expect(reordered).toEqual(['2', '1']);
    expect(created).toEqual(['1', '2']);
    expect(automatic).toBeNull();
  });
});
