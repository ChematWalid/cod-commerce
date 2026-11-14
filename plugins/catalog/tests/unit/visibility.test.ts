import type { ProductStatus } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { VISIBILITY_CONTEXTS } from '../../domain/constants';
import { isVisibleIn, type VisibilityContext } from '../../domain/visibility';

const product = (status: ProductStatus, soldOut = false): { status: ProductStatus; soldOut: boolean } => ({
  status,
  soldOut,
});

describe('isVisibleIn', () => {
  it('hides a draft everywhere public', () => {
    // Arrange
    const publicContexts: VisibilityContext[] = ['listing', 'productPage', 'landingPage'];

    // Act
    const visible = publicContexts.map((context) => isVisibleIn(product('draft'), context, 'keep'));

    // Assert
    expect(visible).toEqual([false, false, false]);
  });

  it('lists hidden only for a landing page', () => {
    // Act
    const visible = VISIBILITY_CONTEXTS.map((context) => [context, isVisibleIn(product('hidden'), context, 'keep')]);

    // Assert
    expect(Object.fromEntries(visible)).toEqual({ listing: false, productPage: false, landingPage: true, admin: true });
  });

  it('shows an active product in every context', () => {
    // Act
    const visible = VISIBILITY_CONTEXTS.map((context) => isVisibleIn(product('active'), context, 'hide'));

    // Assert
    expect(visible.every(Boolean)).toBe(true);
  });

  it('drops a sold-out product from listings when the store hides sold-out', () => {
    // Act
    const visible = VISIBILITY_CONTEXTS.map((context) => [
      context,
      isVisibleIn(product('active', true), context, 'hide'),
    ]);

    // Assert
    expect(Object.fromEntries(visible)).toEqual({ listing: false, productPage: false, landingPage: true, admin: true });
  });

  it('keeps a sold-out product with keep', () => {
    // Act
    const visible = VISIBILITY_CONTEXTS.map((context) => isVisibleIn(product('active', true), context, 'keep'));

    // Assert
    expect(visible.every(Boolean)).toBe(true);
  });

  it('keeps a hidden sold-out product on its landing page when the store hides sold-out', () => {
    // Act
    const visible = isVisibleIn(product('hidden', true), 'landingPage', 'hide');

    // Assert
    expect(visible).toBe(true);
  });

  it('shows every product to the admin, a draft included', () => {
    // Act
    const visible = isVisibleIn(product('draft', true), 'admin', 'hide');

    // Assert
    expect(visible).toBe(true);
  });
});
