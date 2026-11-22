import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { addToCart, CART_STORAGE_KEY, type CartStorage, readCart, removeFromCart } from '../../src/client/cart-store';
import { clampQuantity } from '../../src/client/quantity';
import { VariantPicker } from '../../src/client/variant-picker';
import { initialSelection, type Selection, variantOf, withOption } from '../../src/client/variant-selection';
import { optionGroupChoicesOf, variantChoicesOf } from '../../src/theme/sections/product-info';
import { productFixture } from '../support/storefront-fixtures';

const BASE = 'https://assets.example.dz/assets';
const PRODUCT = productFixture();
const LABELS = { soldOut: 'Sold out', addToCart: 'Add to cart', quantity: 'Quantity', increase: '+', decrease: '-' };

function choices() {
  vi.stubEnv('STOREFRONT_ASSET_BASE', BASE);
  const result = { groups: optionGroupChoicesOf(PRODUCT, 'en'), variants: variantChoicesOf(PRODUCT, 'en') };
  vi.unstubAllEnvs();
  return result;
}

function renderPicker(initial?: Selection): string {
  const { groups, variants } = choices();
  const productImage = { src: `${BASE}/b/1/s/1001/preview/scarf.jpg`, alt: 'Wool Scarf' };
  return renderToStaticMarkup(
    <VariantPicker groups={groups} variants={variants} labels={LABELS} productImage={productImage} initial={initial} />,
  );
}

function priceIn(html: string): string {
  return /data-testid="variant-price">([^<]+)</.exec(html)?.[1] ?? '';
}

describe('variant picker', () => {
  it('starts on the first variant in stock, with its price and the product image', () => {
    // Act
    const html = renderPicker();
    // Assert
    expect(priceIn(html)).toContain('2,500');
    expect(html).toContain(encodeURIComponent(`${BASE}/b/1/s/1001/preview/scarf.jpg`));
    expect(html).toContain('data-variant-id="6001"');
  });

  it('switches the price and the image to the selected option set', () => {
    // Act
    const html = renderPicker({ color: 'blue' });
    // Assert
    expect(priceIn(html)).toContain('2,700');
    expect(html).toContain(encodeURIComponent(`${BASE}/b/1/s/1001/preview/scarf-blue.jpg`));
    expect(html).toContain('Sold out');
    expect(html).toMatch(/<button type="button" class="button" disabled="">Add to cart/);
  });

  it('selects by option: choosing blue after red lands on the blue variant', () => {
    // Arrange
    const { groups, variants } = choices();
    const start = initialSelection(groups, variants);
    // Act
    const next = withOption(start, 'color', 'blue');
    // Assert
    expect(variantOf(variants, start)?.id).toBe('6001');
    expect(variantOf(variants, next)?.id).toBe('6002');
    expect(variantOf(variants, next)?.imageSrc).toBe(`${BASE}/b/1/s/1001/preview/scarf-blue.jpg`);
  });

  it('starts on the first variant when every variant is sold out', () => {
    // Arrange
    const { groups, variants } = choices();
    const allSoldOut = variants.map((variant) => ({ ...variant, soldOut: true }));
    // Act and Assert
    expect(variantOf(allSoldOut, initialSelection(groups, allSoldOut))?.id).toBe('6001');
  });
});

describe('quantity', () => {
  it.each([
    [0, 1],
    [1, 1],
    [42, 42],
    [99, 99],
    [100, 99],
    [-5, 1],
    [2.7, 2],
    [Number.NaN, 1],
  ])('clamps %d to %d', (value, expected) => {
    expect(clampQuantity(value)).toBe(expected);
  });
});

describe('cart store', () => {
  function memoryStorage(initial: Record<string, string> = {}): CartStorage {
    const values = new Map(Object.entries(initial));
    return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => void values.set(key, value) };
  }

  it('keeps variant ids and quantities only, adding to a line of the same variant up to 99', () => {
    // Arrange
    const storage = memoryStorage();
    // Act
    addToCart(storage, { variantId: '6001', quantity: 60 });
    const lines = addToCart(storage, { variantId: '6001', quantity: 60 });
    // Assert
    expect(lines).toEqual([{ variantId: '6001', quantity: 99 }]);
    expect(JSON.parse(storage.getItem(CART_STORAGE_KEY) ?? '')).toEqual([{ variantId: '6001', quantity: 99 }]);
  });

  it('reads an unreadable cart as empty and logs it', () => {
    // Arrange
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Act
    const lines = readCart(memoryStorage({ [CART_STORAGE_KEY]: '{not json' }));
    // Assert
    expect(lines).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('storefront.cart.unreadable'));
  });

  it('drops lines that are not a variant id and a quantity, such as a forged price', () => {
    // Arrange
    const stored = JSON.stringify([
      { variantId: '6001', quantity: 2, price: 1 },
      { variantId: 'x', quantity: 1 },
    ]);
    // Act
    const lines = readCart(memoryStorage({ [CART_STORAGE_KEY]: stored }));
    // Assert
    expect(lines).toEqual([{ variantId: '6001', quantity: 2 }]);
  });

  it('removes a line', () => {
    const storage = memoryStorage();
    addToCart(storage, { variantId: '6001', quantity: 1 });
    expect(removeFromCart(storage, '6001')).toEqual([]);
  });
});
