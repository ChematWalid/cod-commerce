import { clampQuantity } from './quantity';

/** The `localStorage` key of the cart; the version changes with its shape. */
export const CART_STORAGE_KEY = 'cod.cart.v1';

/** The most lines a cart keeps; a cash-on-delivery order is small. */
export const MAX_CART_LINES = 50;

/**
 * One cart line: the variant and how many. Never a price: the server prices the order (ADR 0017), so a price kept in
 * the browser could only be stale or forged.
 */
export interface CartLine {
  readonly variantId: string;
  readonly quantity: number;
}

/** The part of `Storage` the cart uses, so tests pass a fake. */
export interface CartStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const VARIANT_ID_FORMAT = /^[1-9][0-9]{0,18}$/;

function logCartIssue(event: string, error: unknown): void {
  const errorClass = error instanceof Error ? error.name : typeof error;
  console.warn(JSON.stringify({ level: 'warn', event, errorClass }));
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  const { variantId, quantity } = line;
  return typeof variantId === 'string' && VARIANT_ID_FORMAT.test(variantId) && typeof quantity === 'number';
}

function parseLines(text: string): CartLine[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter(isCartLine)
    .slice(0, MAX_CART_LINES)
    .map((line) => ({ variantId: line.variantId, quantity: clampQuantity(line.quantity) }));
}

/** The cart lines of a stored cart text; a missing or unreadable cart is empty (logged), never an error for the buyer. */
export function cartLinesOf(text: string | null): CartLine[] {
  if (text === null) return [];
  try {
    return parseLines(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    logCartIssue('storefront.cart.unreadable', error);
    return [];
  }
}

/** The cart in `storage`. */
export function readCart(storage: CartStorage): CartLine[] {
  return cartLinesOf(storage.getItem(CART_STORAGE_KEY));
}

/** Components showing the cart, told when this page changes it (another tab's changes come as `storage` events). */
const cartListeners = new Set<() => void>();

/** Subscribes `listener` to cart changes, from this page and from other tabs; returns the unsubscribe. */
export function subscribeCart(listener: () => void): () => void {
  cartListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    cartListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function writeCart(storage: CartStorage, lines: readonly CartLine[]): CartLine[] {
  const kept = lines.slice(0, MAX_CART_LINES);
  storage.setItem(CART_STORAGE_KEY, JSON.stringify(kept));
  cartListeners.forEach((listener) => {
    listener();
  });
  return kept;
}

/** Adds `line` to the cart, adding to the quantity of a line of the same variant (still at most 99). */
export function addToCart(storage: CartStorage, line: CartLine): CartLine[] {
  const lines = readCart(storage);
  const existing = lines.find((candidate) => candidate.variantId === line.variantId);
  const quantity = clampQuantity((existing?.quantity ?? 0) + line.quantity);
  const others = lines.filter((candidate) => candidate.variantId !== line.variantId);
  return writeCart(storage, [...others, { variantId: line.variantId, quantity }]);
}

/** Removes the line of `variantId`. */
export function removeFromCart(storage: CartStorage, variantId: string): CartLine[] {
  return writeCart(
    storage,
    readCart(storage).filter((line) => line.variantId !== variantId),
  );
}

/**
 * The browser's `localStorage`, or none when it is unavailable (a private window, blocked site data): the cart then
 * lives only as long as the page.
 */
export function browserCartStorage(): CartStorage | null {
  try {
    return window.localStorage;
  } catch (error) {
    logCartIssue('storefront.cart.storage_unavailable', error);
    return null;
  }
}

/** The stored cart text of this browser, a stable snapshot for `useSyncExternalStore`; none without storage. */
export function cartSnapshot(): string | null {
  return browserCartStorage()?.getItem(CART_STORAGE_KEY) ?? null;
}
