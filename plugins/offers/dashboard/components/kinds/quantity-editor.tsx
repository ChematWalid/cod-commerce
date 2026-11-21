import type { QuantityConfig, QuantityPriceMode } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import type { JSX } from 'react';
import { DEFAULT_QUANTITY_CONFIG } from '../../model/default-configs';
import { readConfig } from '../../model/kind-editors';
import { warningMessageIdOf } from '../../model/preview-warnings';
import { addTier, canAddTier, changeTier, preselectTier, removeTier } from '../../model/quantity-tiers';
import { ChoiceGroup } from '../choice-group';
import type { KindEditorProps } from '../kind-editor-slot';
import { TierRow } from '../tier-row';
import { RolePicker } from './role-picker';

const PRICE_MODE_IDS: Readonly<Record<QuantityPriceMode, string>> = {
  percent: 'offers.field-price-percent',
  total: 'offers.field-price-total',
};

/** The preview's warnings about the tiers (a total not divisible by its pieces, A11), in the merchant's language. */
function TierWarnings({ warnings }: { readonly warnings: readonly string[] }): JSX.Element {
  const { i18n } = useLingui();
  return (
    <>
      {warnings.map((warning) => (
        <p key={warning} role="status" className="text-sm">
          {i18n._(warningMessageIdOf(warning))}
        </p>
      ))}
    </>
  );
}

function TierList({ config, editor }: { readonly config: QuantityConfig; readonly editor: KindEditorProps }) {
  const set = (next: QuantityConfig): void => {
    editor.onConfig(next);
  };
  return (
    <div className="grid gap-3">
      {config.tiers.map((tier, index) => (
        <TierRow
          key={index}
          tier={tier}
          number={index + 1}
          priceMode={config.priceMode}
          disabled={editor.disabled}
          canRemove={config.tiers.length > 1}
          onChange={(change) => {
            set(changeTier(config, index, change));
          }}
          onPreselect={() => {
            set(preselectTier(config, index));
          }}
          onRemove={() => {
            set(removeTier(config, index));
          }}
        />
      ))}
    </div>
  );
}

/** A quantity offer: tiers of pieces with a percent off or a total price, on the chosen products (D2409, D2410). */
export function QuantityEditor(props: KindEditorProps): JSX.Element {
  const { i18n } = useLingui();
  const config = readConfig<QuantityConfig>(props.config, DEFAULT_QUANTITY_CONFIG);
  return (
    <div className="grid gap-4">
      <ChoiceGroup
        legendId="offers.field-price-mode"
        value={config.priceMode}
        labelIds={PRICE_MODE_IDS}
        disabled={props.disabled}
        onChange={(priceMode) => {
          props.onConfig({ ...config, priceMode });
        }}
      />
      <TierList config={config} editor={props} />
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={props.disabled || !canAddTier(config)}
          onClick={() => {
            props.onConfig(addTier(config));
          }}
        >
          {i18n._('offers.field-tier-add')}
        </Button>
      </div>
      <TierWarnings warnings={props.warnings} />
      <RolePicker editor={props} role="buy" legendId="offers.editor-targets" />
    </div>
  );
}
