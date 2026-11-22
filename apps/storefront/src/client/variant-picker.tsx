'use client';

import Image from 'next/image';
import { type ReactNode, useState } from 'react';
import { addToCart, browserCartStorage } from './cart-store';
import { Quantity, type QuantityLabels } from './quantity';
import {
  initialSelection,
  type OptionGroupChoice,
  type Selection,
  type VariantChoice,
  variantOf,
  withOption,
} from './variant-selection';

/** The picker's labels in the store's language, written by the server (no catalogue in the browser). */
export interface VariantPickerLabels extends QuantityLabels {
  readonly soldOut: string;
  readonly addToCart: string;
}

/** The product image the picker shows while the selected variant has none of its own. */
export interface PickerImage {
  readonly src: string;
  readonly alt: string;
}

export interface VariantPickerProps {
  readonly groups: readonly OptionGroupChoice[];
  readonly variants: readonly VariantChoice[];
  readonly labels: VariantPickerLabels;
  readonly productImage: PickerImage | null;
  /** The selection to start on; the first variant in stock when not given. */
  readonly initial?: Selection;
}

/** The edge of the picker image, in CSS pixels; the loader picks the nearest asset preset. */
const PICKER_IMAGE_SIZE = 500;

interface OptionGroupProps {
  readonly group: OptionGroupChoice;
  readonly selected: string | undefined;
  readonly onSelect: (optionCode: string) => void;
}

function OptionGroup({ group, selected, onSelect }: OptionGroupProps): ReactNode {
  return (
    <fieldset className="option-group">
      <legend>{group.label}</legend>
      {group.options.map((option) => (
        <button
          key={option.code}
          type="button"
          aria-pressed={selected === option.code}
          onClick={() => {
            onSelect(option.code);
          }}
        >
          {option.name}
        </button>
      ))}
    </fieldset>
  );
}

function VariantImage({ variant, fallback }: { variant: VariantChoice | undefined; fallback: PickerImage | null }) {
  const src = variant?.imageSrc ?? fallback?.src;
  if (src === undefined) return null;
  return (
    <Image
      src={src}
      alt={fallback?.alt ?? ''}
      width={PICKER_IMAGE_SIZE}
      height={PICKER_IMAGE_SIZE}
      sizes="(min-width: 48rem) 40vw, 90vw"
    />
  );
}

function VariantPrice({ variant }: { variant: VariantChoice | undefined }): ReactNode {
  if (variant === undefined) return null;
  return (
    <p className="price">
      <span data-testid="variant-price">{variant.price}</span>
      {variant.oldPrice === null ? null : <s className="old-price">{variant.oldPrice}</s>}
    </p>
  );
}

/**
 * Picks a variant by its options: the price and the image follow the selected option set, from server values only.
 * "Add to cart" keeps the variant id and the quantity in `localStorage`, never a price (ADR 0017).
 */
export function VariantPicker({ groups, variants, labels, productImage, initial }: VariantPickerProps): ReactNode {
  const [selection, setSelection] = useState<Selection>(initial ?? initialSelection(groups, variants));
  const [quantity, setQuantity] = useState(1);
  const variant = variantOf(variants, selection);
  const add = (): void => {
    const storage = browserCartStorage();
    if (variant !== undefined && storage !== null) addToCart(storage, { variantId: variant.id, quantity });
  };
  return (
    <div className="variant-picker" data-variant-id={variant?.id ?? ''}>
      <VariantImage variant={variant} fallback={productImage} />
      <VariantPrice variant={variant} />
      {groups.map((group) => (
        <OptionGroup
          key={group.code}
          group={group}
          selected={selection[group.code]}
          onSelect={(code) => {
            setSelection(withOption(selection, group.code, code));
          }}
        />
      ))}
      {variant?.soldOut === true ? <p className="sold-out-badge">{labels.soldOut}</p> : null}
      <Quantity value={quantity} onChange={setQuantity} labels={labels} />
      <button type="button" className="button" onClick={add} disabled={variant === undefined || variant.soldOut}>
        {labels.addToCart}
      </button>
    </div>
  );
}
