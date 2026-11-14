import { describe, expect, it } from 'vitest';
import { SOLD_OUT_BEHAVIORS } from '../../src/index';

describe('SOLD_OUT_BEHAVIORS', () => {
  it('lists keep then hide, the store setting tenancy stores and catalog reads', () => {
    // Act
    const behaviors = [...SOLD_OUT_BEHAVIORS];

    // Assert
    expect(behaviors).toEqual(['keep', 'hide']);
  });
});
