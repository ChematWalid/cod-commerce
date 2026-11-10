import { describe, expect, it } from 'vitest';
import { brandedTitle } from '../dashboard/model/document-title';

const PRODUCT = 'CodShop';

describe('brandedTitle', () => {
  it('replaces the stock suffix', () => {
    expect(brandedTitle('Orders • Vendure', PRODUCT)).toBe('Orders • CodShop');
    expect(brandedTitle('Orders • Customers • Vendure', PRODUCT)).toBe('Orders • Customers • CodShop');
  });

  it('turns the bare initial title into the product name', () => {
    expect(brandedTitle('Vendure', PRODUCT)).toBe(PRODUCT);
  });

  it('leaves an unrelated title unchanged', () => {
    expect(brandedTitle('Orders • Shop', PRODUCT)).toBe('Orders • Shop');
    expect(brandedTitle('Vendure orders', PRODUCT)).toBe('Vendure orders');
    expect(brandedTitle('', PRODUCT)).toBe('');
  });

  it('is idempotent', () => {
    for (const title of ['Orders • Vendure', 'Vendure', 'Other', `Home • ${PRODUCT}`, PRODUCT]) {
      const once = brandedTitle(title, PRODUCT);
      expect(brandedTitle(once, PRODUCT)).toBe(once);
    }
  });
});
