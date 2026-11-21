import type { BxgyConfig, BxgyGetSource, BxgyGift } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { JSX } from 'react';
import { DEFAULT_BXGY_CONFIG } from '../../model/default-configs';
import { readConfig } from '../../model/kind-editors';
import { ChoiceGroup } from '../choice-group';
import type { KindEditorProps } from '../kind-editor-slot';
import { NumberField } from '../number-field';
import { SCOPE_IDS } from './product-discount-editor';
import { RolePicker } from './role-picker';

type GiftMode = BxgyGift['mode'];

const GET_FROM_IDS: Readonly<Record<BxgyGetSource, string>> = {
  same: 'offers.field-get-same',
  targets: 'offers.field-get-targets',
};
const GIFT_MODE_IDS: Readonly<Record<GiftMode, string>> = {
  free: 'offers.field-gift-free',
  percent: 'offers.field-percent-off',
  fixed: 'offers.field-amount-off',
};
const GIFT_UNIT_IDS: Readonly<Record<Exclude<GiftMode, 'free'>, string>> = {
  percent: 'offers.unit-percent',
  fixed: 'offers.unit-dzd',
};
/** The value a gift price starts with when the merchant moves off "free": 50 % or 100 DZD off, typed over at once. */
const FIRST_GIFT_VALUE: Readonly<Record<Exclude<GiftMode, 'free'>, number>> = { percent: 50, fixed: 100 };

const giftOf = (mode: GiftMode): BxgyGift => (mode === 'free' ? { mode } : { mode, value: FIRST_GIFT_VALUE[mode] });

interface BxgyPartProps {
  readonly config: BxgyConfig;
  readonly editor: KindEditorProps;
}

/** The gifted piece's price: free, a percent off or an amount off (D2503). */
function GiftFields({ config, editor }: BxgyPartProps): JSX.Element {
  const { i18n } = useLingui();
  const { gift } = config;
  return (
    <div className="grid gap-3">
      <ChoiceGroup
        legendId="offers.field-gift"
        value={gift.mode}
        labelIds={GIFT_MODE_IDS}
        disabled={editor.disabled}
        onChange={(mode) => {
          editor.onConfig({ ...config, gift: giftOf(mode) });
        }}
      />
      {gift.mode !== 'free' && (
        <NumberField
          label={i18n._('offers.field-value')}
          suffix={i18n._(GIFT_UNIT_IDS[gift.mode])}
          value={gift.value}
          disabled={editor.disabled}
          onValue={(value) => {
            if (value !== null) editor.onConfig({ ...config, gift: { ...gift, value } });
          }}
        />
      )}
    </div>
  );
}

/** How many pieces are bought and gifted, and how many times one order may earn it (blank for no cap). */
function QuantityFields({ config, editor }: BxgyPartProps): JSX.Element {
  const { i18n } = useLingui();
  const set = (change: Partial<BxgyConfig>): void => {
    editor.onConfig({ ...config, ...change });
  };
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <NumberField
        label={i18n._('offers.field-buy-quantity')}
        value={config.buyQuantity}
        disabled={editor.disabled}
        onValue={(buyQuantity) => {
          if (buyQuantity !== null) set({ buyQuantity });
        }}
      />
      <NumberField
        label={i18n._('offers.field-get-quantity')}
        value={config.getQuantity}
        disabled={editor.disabled}
        onValue={(getQuantity) => {
          if (getQuantity !== null) set({ getQuantity });
        }}
      />
      <NumberField
        label={i18n._('offers.field-max-times')}
        hint={i18n._('offers.field-blank-hint')}
        value={config.maxTimesPerOrder}
        disabled={editor.disabled}
        onValue={(maxTimesPerOrder) => {
          set({ maxTimesPerOrder });
        }}
      />
    </div>
  );
}

/** Buy x, get y: on every product or the chosen ones, gifting more of the same or other chosen items (D2503). */
export function BxgyEditor(props: KindEditorProps): JSX.Element {
  const config = readConfig<BxgyConfig>(props.config, DEFAULT_BXGY_CONFIG);
  return (
    <div className="grid gap-4">
      <ChoiceGroup
        legendId="offers.field-applies-to"
        value={config.appliesTo}
        labelIds={SCOPE_IDS}
        disabled={props.disabled}
        onChange={(appliesTo) => {
          props.onConfig({ ...config, appliesTo });
        }}
      />
      {config.appliesTo === 'targets' && <RolePicker editor={props} role="buy" legendId="offers.editor-targets" />}
      <QuantityFields config={config} editor={props} />
      <ChoiceGroup
        legendId="offers.field-get-from"
        value={config.getFrom}
        labelIds={GET_FROM_IDS}
        disabled={props.disabled}
        onChange={(getFrom) => {
          props.onConfig({ ...config, getFrom });
        }}
      />
      {config.getFrom === 'targets' && <RolePicker editor={props} role="get" legendId="offers.field-get-items" />}
      <GiftFields config={config} editor={props} />
    </div>
  );
}
