import { type OfferEligibility, WILAYAS } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { type JSX, useState } from 'react';
import { DEFAULT_FREE_DELIVERY_CONFIG } from '../../model/default-configs';
import { type DeliveryChoice, deliveryChoiceOf, deliveryMethodsOf, toggleWilaya } from '../../model/delivery-choice';
import { readConfig } from '../../model/kind-editors';
import { CheckRow } from '../check-row';
import { ChoiceGroup } from '../choice-group';
import type { KindEditorProps } from '../kind-editor-slot';
import { ThresholdFields } from './threshold-fields';

const THRESHOLD_IDS = {
  none: 'offers.field-threshold-none',
  pieces: 'offers.field-threshold-pieces',
  amount: 'offers.field-threshold-amount',
} as const;
const DELIVERY_CHOICE_IDS: Readonly<Record<DeliveryChoice, string>> = {
  both: 'offers.field-delivery-both',
  home: 'offers.field-delivery-home',
  desk: 'offers.field-delivery-desk',
};

type WilayaMode = 'all' | 'chosen';
const WILAYA_MODE_IDS: Readonly<Record<WilayaMode, string>> = {
  all: 'offers.field-wilayas-all',
  chosen: 'offers.field-wilayas-chosen',
};

interface EligibilityProps {
  readonly eligibility: OfferEligibility;
  readonly onEligibility: (next: OfferEligibility) => void;
  readonly disabled: boolean;
}

/** Every wilaya, or the ticked ones; "every" is the empty list (D2420), so choosing it clears the ticks. */
function WilayaFields({ eligibility, onEligibility, disabled }: EligibilityProps): JSX.Element {
  const { i18n } = useLingui();
  const [mode, setMode] = useState<WilayaMode>(eligibility.wilayas.length === 0 ? 'all' : 'chosen');
  const names = (names: { readonly ar: string; readonly fr: string }): string =>
    i18n.locale.startsWith('ar') ? names.ar : names.fr;
  return (
    <div className="grid gap-2">
      <ChoiceGroup
        legendId="offers.field-wilayas"
        value={mode}
        labelIds={WILAYA_MODE_IDS}
        disabled={disabled}
        onChange={(next) => {
          setMode(next);
          if (next === 'all') onEligibility({ ...eligibility, wilayas: [] });
        }}
      />
      {mode === 'chosen' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WILAYAS.map((wilaya) => (
            <CheckRow
              key={wilaya.code}
              label={
                wilaya.names === null
                  ? i18n._('offers.field-wilaya', { code: wilaya.code })
                  : `${wilaya.code} ${names(wilaya.names)}`
              }
              checked={eligibility.wilayas.includes(wilaya.code)}
              disabled={disabled}
              onToggle={(on) => {
                onEligibility({ ...eligibility, wilayas: toggleWilaya(eligibility.wilayas, wilaya.code, on) });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A free-delivery offer: from a number of pieces, an amount or always, for the chosen delivery methods and wilayas.
 * Methods and wilayas are the offer's eligibility, the one source of truth (D2413); the store pays the fee.
 */
export function FreeDeliveryEditor(props: KindEditorProps): JSX.Element {
  const { i18n } = useLingui();
  const config = readConfig(props.config, DEFAULT_FREE_DELIVERY_CONFIG);
  const { eligibility } = props;
  return (
    <div className="grid gap-4">
      <ThresholdFields
        legendId="offers.field-threshold"
        labelIds={THRESHOLD_IDS}
        value={config.threshold}
        disabled={props.disabled}
        onChange={(threshold) => {
          props.onConfig({ ...config, threshold });
        }}
      />
      <ChoiceGroup
        legendId="offers.field-delivery-methods"
        value={deliveryChoiceOf(eligibility.deliveryMethods)}
        labelIds={DELIVERY_CHOICE_IDS}
        disabled={props.disabled}
        onChange={(choice) => {
          props.onEligibility({ ...eligibility, deliveryMethods: deliveryMethodsOf(choice) });
        }}
      />
      <WilayaFields eligibility={eligibility} onEligibility={props.onEligibility} disabled={props.disabled} />
      <p className="text-muted-foreground text-xs">{i18n._('offers.field-fee-note')}</p>
    </div>
  );
}
