import type { AddonCondition, AddonConfig, AddonPlacement, AddonPrice } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { JSX } from 'react';
import { DEFAULT_ADDON_CONFIG } from '../../model/default-configs';
import { readConfig } from '../../model/kind-editors';
import { ChoiceGroup } from '../choice-group';
import type { KindEditorProps } from '../kind-editor-slot';
import { NumberField } from '../number-field';
import { RolePicker } from './role-picker';

type PriceMode = AddonPrice['mode'];

const CONDITION_IDS: Readonly<Record<AddonCondition, string>> = {
  any_order: 'offers.field-addon-any-order',
  targets: 'offers.field-addon-with-targets',
};
const PRICE_MODE_IDS: Readonly<Record<PriceMode, string>> = {
  fixed: 'offers.field-addon-fixed',
  percent: 'offers.field-percent-off',
  amount_off: 'offers.field-amount-off',
};
const PRICE_UNIT_IDS: Readonly<Record<PriceMode, string>> = {
  fixed: 'offers.unit-dzd',
  percent: 'offers.unit-percent',
  amount_off: 'offers.unit-dzd',
};
const PLACEMENT_IDS: Readonly<Record<AddonPlacement, string>> = {
  order_form: 'offers.field-addon-order-form',
  thank_you: 'offers.field-addon-thank-you',
};

interface AddonPartProps {
  readonly config: AddonConfig;
  readonly editor: KindEditorProps;
}

/** The add-on's price: fixed (0 is free), a percent off or an amount off its list price (D2505). */
function PriceFields({ config, editor }: AddonPartProps): JSX.Element {
  const { i18n } = useLingui();
  const { price } = config;
  return (
    <div className="grid gap-3">
      <ChoiceGroup
        legendId="offers.field-addon-price"
        value={price.mode}
        labelIds={PRICE_MODE_IDS}
        disabled={editor.disabled}
        onChange={(mode) => {
          editor.onConfig({ ...config, price: { ...price, mode } });
        }}
      />
      <NumberField
        label={i18n._('offers.field-value')}
        suffix={i18n._(PRICE_UNIT_IDS[price.mode])}
        value={price.value}
        disabled={editor.disabled}
        onValue={(value) => {
          if (value !== null) editor.onConfig({ ...config, price: { ...price, value } });
        }}
      />
    </div>
  );
}

/**
 * An add-on: up to five products offered with any order or with the chosen products, at a set price, on the order
 * form or the thank-you page (D2505, D2506).
 */
export function AddonEditor(props: KindEditorProps): JSX.Element {
  const { i18n } = useLingui();
  const config = readConfig<AddonConfig>(props.config, DEFAULT_ADDON_CONFIG);
  return (
    <div className="grid gap-4">
      <RolePicker editor={props} role="addon" legendId="offers.field-addon-products" />
      <ChoiceGroup
        legendId="offers.field-addon-condition"
        value={config.condition}
        labelIds={CONDITION_IDS}
        disabled={props.disabled}
        onChange={(condition) => {
          props.onConfig({ ...config, condition });
        }}
      />
      {config.condition === 'targets' && (
        <RolePicker editor={props} role="buy" legendId="offers.field-addon-buy-items" />
      )}
      <PriceFields config={config} editor={props} />
      <NumberField
        label={i18n._('offers.field-addon-pieces')}
        value={config.maxPiecesPerOrder}
        disabled={props.disabled}
        onValue={(maxPiecesPerOrder) => {
          if (maxPiecesPerOrder !== null) props.onConfig({ ...config, maxPiecesPerOrder });
        }}
      />
      <ChoiceGroup
        legendId="offers.field-addon-placement"
        value={config.placement}
        labelIds={PLACEMENT_IDS}
        disabled={props.disabled}
        onChange={(placement) => {
          props.onConfig({ ...config, placement });
        }}
      />
    </div>
  );
}
