import type { QuantityPriceMode, QuantityTier } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { PERCENT_CHIPS } from '../model/quantity-tiers';
import { CheckRow } from './check-row';
import { LtrRun } from './ltr-run';
import { NumberField } from './number-field';

export interface TierRowProps {
  readonly tier: QuantityTier;
  /** The tier's place, from 1, for its heading. */
  readonly number: number;
  readonly priceMode: QuantityPriceMode;
  readonly disabled: boolean;
  readonly canRemove: boolean;
  readonly onChange: (change: Partial<QuantityTier>) => void;
  readonly onPreselect: () => void;
  readonly onRemove: () => void;
}

const PRICE_LABEL_IDS: Readonly<Record<QuantityPriceMode, string>> = {
  percent: 'offers.field-tier-percent',
  total: 'offers.field-tier-total',
};
const PRICE_UNIT_IDS: Readonly<Record<QuantityPriceMode, string>> = {
  percent: 'offers.unit-percent',
  total: 'offers.unit-dzd',
};

/** The one-click percents of a percent-mode tier; the chosen one is highlighted. */
function PercentChips(props: Pick<TierRowProps, 'tier' | 'disabled' | 'onChange'>): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={i18n._('offers.field-tier-chips')}>
      {PERCENT_CHIPS.map((percent) => (
        <Button
          key={percent}
          type="button"
          size="sm"
          variant={props.tier.price === percent ? 'default' : 'outline'}
          aria-pressed={props.tier.price === percent}
          disabled={props.disabled}
          onClick={() => {
            props.onChange({ price: percent });
          }}
        >
          <LtrRun>
            {percent} {i18n._('offers.unit-percent')}
          </LtrRun>
        </Button>
      ))}
    </div>
  );
}

/** The tier's two numbers: from how many pieces, and its percent off or total price. */
function TierNumbers({ tier, priceMode, disabled, onChange }: TierRowProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <NumberField
        label={i18n._('offers.field-tier-quantity')}
        value={tier.quantity}
        disabled={disabled}
        onValue={(quantity) => {
          if (quantity !== null) onChange({ quantity });
        }}
      />
      <NumberField
        label={i18n._(PRICE_LABEL_IDS[priceMode])}
        value={tier.price}
        suffix={i18n._(PRICE_UNIT_IDS[priceMode])}
        disabled={disabled}
        onValue={(price) => {
          if (price !== null) onChange({ price });
        }}
      />
    </div>
  );
}

/** One quantity tier: from how many pieces, its price, whether it is picked at first and delivers free. */
export function TierRow(props: TierRowProps): ReactNode {
  const { i18n } = useLingui();
  const { tier } = props;
  return (
    <fieldset className="grid gap-3 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">
        {i18n._('offers.field-tier-heading', { number: props.number })}
      </legend>
      <TierNumbers {...props} />
      {props.priceMode === 'percent' && <PercentChips {...props} />}
      <CheckRow
        label={i18n._('offers.field-tier-preselected')}
        checked={tier.preselected}
        disabled={props.disabled}
        onToggle={props.onPreselect}
      />
      <CheckRow
        label={i18n._('offers.field-tier-free-delivery')}
        checked={tier.freeDelivery}
        disabled={props.disabled}
        onToggle={(freeDelivery) => {
          props.onChange({ freeDelivery });
        }}
      />
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={props.disabled || !props.canRemove}
          onClick={props.onRemove}
        >
          {i18n._('offers.field-tier-remove')}
        </Button>
      </div>
    </fieldset>
  );
}
