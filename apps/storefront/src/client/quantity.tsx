'use client';

import type { ReactNode } from 'react';

/** The fewest items a buyer can order of one variant. */
export const MIN_QUANTITY = 1;

/** The most items of one variant in one order: a cash-on-delivery order larger than this is called in. */
export const MAX_QUANTITY = 99;

/** `value` as a whole quantity from 1 to 99; anything that is not a number is 1. */
export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(value)));
}

/** The labels of the stepper, in the store's language. */
export interface QuantityLabels {
  readonly quantity: string;
  readonly increase: string;
  readonly decrease: string;
}

interface QuantityProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly labels: QuantityLabels;
}

/** A quantity stepper that never leaves 1..99. */
export function Quantity({ value, onChange, labels }: QuantityProps): ReactNode {
  const change = (next: number): void => {
    onChange(clampQuantity(next));
  };
  return (
    <div className="quantity" role="group" aria-label={labels.quantity}>
      <button
        type="button"
        aria-label={labels.decrease}
        onClick={() => {
          change(value - 1);
        }}
        disabled={value <= MIN_QUANTITY}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={MIN_QUANTITY}
        max={MAX_QUANTITY}
        value={value}
        aria-label={labels.quantity}
        onChange={(event) => {
          change(Number(event.target.value));
        }}
      />
      <button
        type="button"
        aria-label={labels.increase}
        onClick={() => {
          change(value + 1);
        }}
        disabled={value >= MAX_QUANTITY}
      >
        +
      </button>
    </div>
  );
}
