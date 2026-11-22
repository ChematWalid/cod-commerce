'use client';

import { type ReactNode, useMemo, useSyncExternalStore } from 'react';
import { browserCartStorage, cartLinesOf, cartSnapshot, removeFromCart, subscribeCart } from './cart-store';

/** The cart's labels in the store's language, written by the server. */
export interface CartViewLabels {
  readonly empty: string;
  readonly remove: string;
  readonly quantity: string;
}

interface CartViewProps {
  readonly labels: CartViewLabels;
}

/** The server renders the empty cart: the cart lives in the browser only. */
const serverSnapshot = (): string | null => null;

/**
 * The cart lines kept in this browser: variant and quantity only. Names and prices come with the order summary of
 * P3.S3, read from the server; nothing here prices an order.
 */
export function CartView({ labels }: CartViewProps): ReactNode {
  const text = useSyncExternalStore(subscribeCart, cartSnapshot, serverSnapshot);
  const lines = useMemo(() => cartLinesOf(text), [text]);
  const remove = (variantId: string): void => {
    const storage = browserCartStorage();
    if (storage !== null) removeFromCart(storage, variantId);
  };
  if (lines.length === 0) return <p className="cart-empty">{labels.empty}</p>;
  return (
    <ul className="cart-lines">
      {lines.map((line) => (
        <li key={line.variantId} data-variant-id={line.variantId}>
          <span>
            {labels.quantity}: {line.quantity}
          </span>
          <button
            type="button"
            onClick={() => {
              remove(line.variantId);
            }}
          >
            {labels.remove}
          </button>
        </li>
      ))}
    </ul>
  );
}
