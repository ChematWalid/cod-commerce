import { describe, expect, it } from 'vitest';
import { cartHash, phoneKey, type CartHashInput } from '../../../domain/token/cart-hash';
import { syntheticSecret } from '../../support/quote-keys';

const KEY = syntheticSecret('cart-hash');

const aHashInput = (overrides: Partial<CartHashInput> = {}): CartHashInput => ({
  channel: 'storefront',
  lines: [
    { variantId: '11', quantity: 2 },
    { variantId: '7', quantity: 1 },
  ],
  destination: { provinceCode: '16', townOns: '1601', stopdesk: false },
  codes: [],
  phoneKey: null,
  ...overrides,
});

describe('cartHash', () => {
  it('hashes the same cart in any line order to one value', () => {
    // Arrange
    const forward = aHashInput();
    const backward = aHashInput({ lines: [...forward.lines].reverse() });

    // Act
    const hashes = [cartHash(forward), cartHash(backward)];

    // Assert
    expect(hashes[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(hashes[0]).toBe(hashes[1]);
  });

  it('hashes two lines of one variant like the merged line', () => {
    // Arrange
    const split = aHashInput({
      lines: [
        { variantId: '7', quantity: 1 },
        { variantId: '7', quantity: 1 },
      ],
    });
    const merged = aHashInput({ lines: [{ variantId: '7', quantity: 2 }] });

    // Act
    const hashes = [cartHash(split), cartHash(merged)];

    // Assert
    expect(hashes[0]).toBe(hashes[1]);
  });

  it('changes the hash when a line quantity changes', () => {
    // Arrange
    const one = aHashInput({ lines: [{ variantId: '7', quantity: 1 }] });
    const two = aHashInput({ lines: [{ variantId: '7', quantity: 2 }] });

    // Act
    const hashes = [cartHash(one), cartHash(two)];

    // Assert
    expect(hashes[0]).not.toBe(hashes[1]);
  });

  it('changes the hash when the channel changes', () => {
    // Arrange
    const storefront = aHashInput({ channel: 'storefront' });
    const landing = aHashInput({ channel: 'landing_page' });

    // Act
    const hashes = [cartHash(storefront), cartHash(landing)];

    // Assert
    expect(hashes[0]).not.toBe(hashes[1]);
  });

  it("hashes ' influ10 ' and 'INFLU10' alike", () => {
    // Arrange
    const loose = aHashInput({ codes: [' influ10 ', 'welcome'] });
    const normal = aHashInput({ codes: ['WELCOME', 'INFLU10', 'INFLU10'] });

    // Act
    const hashes = [cartHash(loose), cartHash(normal)];

    // Assert
    expect(hashes[0]).toBe(hashes[1]);
  });

  it('does not confuse a townOns containing separators with another destination', () => {
    // Arrange
    const tricky = aHashInput({ destination: { provinceCode: '16', townOns: '1601:true', stopdesk: false } });
    const plain = aHashInput({ destination: { provinceCode: '16', townOns: '1601', stopdesk: true } });

    // Act
    const hashes = [cartHash(tricky), cartHash(plain)];

    // Assert
    expect(hashes[0]).not.toBe(hashes[1]);
  });

  it('hashes a destination without a commune apart from no destination', () => {
    // Arrange
    const noTown = aHashInput({ destination: { provinceCode: '16', stopdesk: false } });
    const none = aHashInput({ destination: null });

    // Act
    const hashes = [cartHash(noTown), cartHash(none)];

    // Assert
    expect(hashes[0]).not.toBe(hashes[1]);
  });

  it('changes the hash when a phone key is added', () => {
    // Arrange
    const anonymous = aHashInput();
    const known = aHashInput({ phoneKey: phoneKey(KEY, '+213555123456') });

    // Act
    const hashes = [cartHash(anonymous), cartHash(known)];

    // Assert
    expect(hashes[0]).not.toBe(hashes[1]);
  });
});

describe('cartHash: add-ons (D2506)', () => {
  /** The P2.S4 hash of {@link aHashInput}: a cart without add-ons keeps it. */
  const P2_S4_HASH = '64fb8d596362b688322fc1b4eeb6184bcef9f636357ad2db8c50801a8c1f49dd';
  const ADDON = { offerId: '7006', variantId: '21', quantity: 1 };

  it('keeps the P2.S4 hash of a cart without add-ons', () => {
    // Arrange
    const withoutKey = aHashInput();
    const empty = aHashInput({ addons: [] });

    // Act
    const hashes = [cartHash(withoutKey), cartHash(empty)];

    // Assert
    expect(hashes).toEqual([P2_S4_HASH, P2_S4_HASH]);
  });

  it('changes h when an add-on changes', () => {
    // Arrange
    const carts = [
      aHashInput({ addons: [ADDON] }),
      aHashInput({ addons: [{ ...ADDON, offerId: '7007' }] }),
      aHashInput({ addons: [{ ...ADDON, variantId: '22' }] }),
      aHashInput({ addons: [{ ...ADDON, quantity: 2 }] }),
      aHashInput(),
    ];

    // Act
    const hashes = carts.map(cartHash);

    // Assert
    expect(new Set(hashes).size).toBe(carts.length);
  });

  it('ignores add-on order', () => {
    // Arrange
    const second = { offerId: '7006', variantId: '102', quantity: 3 };
    const third = { offerId: '10', variantId: '21', quantity: 1 };
    const forward = aHashInput({ addons: [ADDON, second, third] });
    const backward = aHashInput({ addons: [third, second, ADDON] });

    // Act
    const hashes = [cartHash(forward), cartHash(backward)];

    // Assert
    expect(hashes[0]).toBe(hashes[1]);
  });
});

describe('phoneKey', () => {
  it('derives one phone key from one E.164 phone and another from another phone', () => {
    // Arrange
    const phone = '+213555123456';

    // Act
    const first = phoneKey(KEY, phone);
    const again = phoneKey(KEY, phone);
    const other = phoneKey(KEY, '+213555123457');

    // Assert
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(again).toBe(first);
    expect(other).not.toBe(first);
  });

  it('derives another phone key under another key', () => {
    // Arrange
    const phone = '+213555123456';

    // Act
    const keys = [phoneKey(KEY, phone), phoneKey(syntheticSecret('other'), phone)];

    // Assert
    expect(keys[0]).not.toBe(keys[1]);
  });
});
