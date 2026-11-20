import { describe, expect, it } from 'vitest';
import { OfferAppTypeService } from '../../application/offer-app-type.service';
import { OFFER_APP_TYPES } from '../../domain/app-types';
import { REGISTRY } from '../support/pipeline';

describe('offer app types (D2515)', () => {
  it('lists seven app types with discount codes as a product discount with codes', () => {
    // Arrange
    const service = new OfferAppTypeService();

    // Act
    const appTypes = service.list();

    // Assert
    expect(appTypes.map((appType) => appType.id)).toEqual([
      'quantity',
      'free_delivery',
      'product_discount',
      'discount_codes',
      'bxgy',
      'order_discount',
      'addon',
    ]);
    expect(appTypes.find((appType) => appType.id === 'discount_codes')).toEqual({
      id: 'discount_codes',
      kind: 'product_discount',
      method: 'codes',
      goal: 'influencers',
      recommended: false,
    });
    expect(appTypes.filter((appType) => appType.recommended).map((appType) => appType.id)).toEqual(['quantity']);
  });

  it('names only registered kinds', () => {
    // Arrange
    const kinds = REGISTRY.kinds();

    // Act
    const unknown = OFFER_APP_TYPES.filter((appType) => !kinds.includes(appType.kind));

    // Assert
    expect(unknown).toEqual([]);
  });

  it('appends an app-registered type', () => {
    // Arrange
    const service = new OfferAppTypeService();
    const appType = {
      id: 'app_bundle',
      kind: 'quantity',
      method: 'automatic',
      goal: null,
      recommended: false,
    } as const;

    // Act
    service.register(appType);

    // Assert
    expect(service.list()).toHaveLength(OFFER_APP_TYPES.length + 1);
    expect(service.list().at(-1)).toEqual(appType);
  });

  it('refuses a second app type with an id already listed', () => {
    // Arrange
    const service = new OfferAppTypeService();
    const appType = { id: 'quantity', kind: 'quantity', method: 'automatic', goal: null, recommended: false } as const;

    // Act
    const register = () => {
      service.register(appType);
    };

    // Assert
    expect(register).toThrow('quantity');
  });
});
