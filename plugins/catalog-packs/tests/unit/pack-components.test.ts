import { CATALOG_PACKS_ERROR_CODES, PACK_MAX_COMPONENTS, PACK_MAX_QUANTITY } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  pickableProducts,
  typedQuantity,
  withComponent,
  withComponentChange,
  withoutComponent,
} from '../../dashboard/model/pack-components';
import { FORBIDDEN_MESSAGE_ID, GENERIC_ERROR_MESSAGE_ID, packErrorMessageId } from '../../dashboard/model/pack-errors';
import { emptyPackForm } from '../../dashboard/model/pack-form';

const shirt = { id: '11', title: 'Shirt', type: 'physical', variants: [{ id: '1101', name: 'Shirt' }] };
const cap = { id: '12', title: 'Cap', type: 'physical', variants: [{ id: '1201', name: 'Cap' }] };
const otherPack = { id: '13', title: 'Duo', type: 'pack', variants: [{ id: '1301', name: 'Duo' }] };
/** The pack being edited, listed with a non-pack type (its type change not saved yet), so only its id excludes it. */
const self = { id: '30', title: 'This pack', type: 'physical', variants: [] };

describe('pack components', () => {
  it('offers neither packs, nor the pack itself, nor a product already in it', () => {
    // Arrange
    const form = withComponent(emptyPackForm(), shirt);

    // Act
    const offered = pickableProducts([shirt, cap, otherPack, self], '30', form);

    // Assert
    expect(offered.map((product) => product.id)).toEqual(['12']);
  });

  it('adds a product once, with quantity 1 and no pinned variant', () => {
    // Act
    const form = withComponent(withComponent(emptyPackForm(), shirt), shirt);

    // Assert
    expect(form.components).toEqual([{ productId: '11', title: 'Shirt', variantId: null, quantity: 1 }]);
  });

  it('adds no component beyond the most a pack holds', () => {
    // Arrange
    let form = emptyPackForm();
    for (let id = 1; id <= PACK_MAX_COMPONENTS + 1; id += 1) form = withComponent(form, { ...shirt, id: String(id) });

    // Assert
    expect(form.components).toHaveLength(PACK_MAX_COMPONENTS);
  });

  it('changes and removes a line by its position', () => {
    // Arrange
    const form = withComponent(withComponent(emptyPackForm(), shirt), cap);

    // Act
    const changed = withComponentChange(form, 1, { quantity: 3, variantId: '1201' });
    const removed = withoutComponent(changed, 0);

    // Assert
    expect(removed.components).toEqual([{ productId: '12', title: 'Cap', variantId: '1201', quantity: 3 }]);
  });

  it('reads a typed quantity up to the most a line holds, and nothing while the field is empty or not a count', () => {
    // Assert
    expect(['', '0', 'abc', '4', '1000'].map(typedQuantity)).toEqual([
      undefined,
      undefined,
      undefined,
      4,
      PACK_MAX_QUANTITY,
    ]);
  });
});

describe('pack error messages', () => {
  const graphQlError = (code: string) => ({ message: 'x', extensions: { code } });

  it('shows a pack code as its own message, forbidden as forbidden, anything else as generic', () => {
    // Assert
    expect(packErrorMessageId(graphQlError(CATALOG_PACKS_ERROR_CODES.NO_COMMON_VALUE))).toBe(
      CATALOG_PACKS_ERROR_CODES.NO_COMMON_VALUE,
    );
    expect(packErrorMessageId(graphQlError('FORBIDDEN'))).toBe(FORBIDDEN_MESSAGE_ID);
    expect(packErrorMessageId(graphQlError('catalog.invalid-input'))).toBe(GENERIC_ERROR_MESSAGE_ID);
    expect(packErrorMessageId(new Error('network'))).toBe(GENERIC_ERROR_MESSAGE_ID);
  });
});
