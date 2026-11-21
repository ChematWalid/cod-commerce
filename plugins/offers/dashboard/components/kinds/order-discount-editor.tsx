import type { OrderDiscountConfig } from '@cod/shared';
import type { JSX } from 'react';
import { DEFAULT_ORDER_DISCOUNT_CONFIG } from '../../model/default-configs';
import { readConfig } from '../../model/kind-editors';
import type { KindEditorProps } from '../kind-editor-slot';
import { DiscountFields } from './discount-fields';
import { ThresholdFields } from './threshold-fields';

const MINIMUM_IDS = {
  none: 'offers.field-minimum-none',
  amount: 'offers.field-minimum-amount',
  pieces: 'offers.field-minimum-pieces',
} as const;

/** An order discount: a percent or an amount off the order, capped, from an optional minimum (D2409, D2412). */
export function OrderDiscountEditor(props: KindEditorProps): JSX.Element {
  const config = readConfig<OrderDiscountConfig>(props.config, DEFAULT_ORDER_DISCOUNT_CONFIG);
  return (
    <div className="grid gap-4">
      <DiscountFields
        value={config}
        capLabelId="offers.field-order-cap"
        disabled={props.disabled}
        onChange={(value) => {
          props.onConfig({ ...config, ...value });
        }}
      />
      <ThresholdFields
        legendId="offers.field-minimum"
        labelIds={MINIMUM_IDS}
        value={config.minimum}
        disabled={props.disabled}
        onChange={(minimum) => {
          props.onConfig({ ...config, minimum });
        }}
      />
    </div>
  );
}
