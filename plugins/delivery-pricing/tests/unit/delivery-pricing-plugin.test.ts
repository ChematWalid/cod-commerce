import { describe, expect, it } from 'vitest';
import { DeliveryPricingPlugin } from '../../index';

/** Vendure's metadata key for a plugin's dashboard entry. */
const DASHBOARD_KEY = 'dashboard';

describe('DeliveryPricingPlugin', () => {
  it('declares its dashboard entry (the Delivery pricing tab)', () => {
    // Act
    const dashboard: unknown = Reflect.getMetadata(DASHBOARD_KEY, DeliveryPricingPlugin);

    // Assert
    expect(dashboard).toBe('./dashboard/index.tsx');
  });
});
