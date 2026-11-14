import { NAME_IN_DELIVERY_MAX } from '@cod/shared';
import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import type { EditorForm, SettingsDraft } from '../model/editor-form';
import { OrderManagersField } from './order-managers-field';
import type { ScopedSectionProps } from './section-props';
import { SwitchRow } from './switch-row';

type SettingsProps = ScopedSectionProps & { readonly held: ReadonlySet<string> };
type SwitchKey = 'isFragile' | 'allowParcelOpening' | 'soldOut' | 'allowOutOfStockOrders' | 'quantityEnabled';
type SizeKey = 'weight' | 'width' | 'height' | 'length';

/** The switches in display order with their label ids; sold out is the manual flag until stock exists (D2107). */
const SWITCHES: readonly { readonly key: SwitchKey; readonly labelId: string }[] = [
  { key: 'isFragile', labelId: 'catalog.editor-fragile' },
  { key: 'allowParcelOpening', labelId: 'catalog.editor-parcel-opening' },
  { key: 'soldOut', labelId: 'catalog.editor-sold-out' },
  { key: 'allowOutOfStockOrders', labelId: 'catalog.editor-out-of-stock-orders' },
  { key: 'quantityEnabled', labelId: 'catalog.editor-quantity-rules' },
];

/** Grams and centimetres, whole numbers (D2125). */
const SIZES: readonly { readonly key: SizeKey; readonly labelId: string; readonly unitId: string }[] = [
  { key: 'weight', labelId: 'catalog.editor-weight', unitId: 'catalog.unit-grams' },
  { key: 'width', labelId: 'catalog.editor-width', unitId: 'catalog.unit-cm' },
  { key: 'height', labelId: 'catalog.editor-height', unitId: 'catalog.unit-cm' },
  { key: 'length', labelId: 'catalog.editor-length', unitId: 'catalog.unit-cm' },
];

function QuantityRules({
  form,
  errors,
  disabled,
  onSettings,
}: SettingsProps & { readonly onSettings: (c: Partial<SettingsDraft>) => void }) {
  const { i18n } = useLingui();
  if (!form.settings.quantityEnabled) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        label={i18n._('catalog.editor-quantity-min')}
        inputMode="numeric"
        value={form.settings.quantityMin}
        disabled={disabled}
        errorId={errors.settings}
        onChange={(event) => {
          onSettings({ quantityMin: event.target.value });
        }}
      />
      <TextField
        label={i18n._('catalog.editor-quantity-step')}
        inputMode="numeric"
        value={form.settings.quantityStep}
        disabled={disabled}
        onChange={(event) => {
          onSettings({ quantityStep: event.target.value });
        }}
      />
    </div>
  );
}

function SizeFields({ form, errors, disabled, onChange }: SettingsProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SIZES.map(({ key, labelId, unitId }) => (
        <TextField
          key={key}
          label={i18n._(labelId)}
          inputMode="numeric"
          suffix={i18n._(unitId)}
          value={form[key]}
          disabled={disabled}
          errorId={errors[key]}
          onChange={(event) => {
            onChange({ [key]: event.target.value } satisfies Partial<EditorForm>);
          }}
        />
      ))}
    </div>
  );
}

/** Delivery and ordering settings of the product in its store (AC5), its sizes and its order managers. */
export function SettingsSection(props: SettingsProps): ReactNode {
  const { i18n } = useLingui();
  const { form, disabled, onChange } = props;
  const onSettings = (change: Partial<SettingsDraft>): void => {
    onChange({ settings: { ...form.settings, ...change } });
  };
  return (
    <div className="grid gap-4">
      <TextField
        label={i18n._('catalog.editor-name-in-delivery')}
        value={form.settings.nameInDelivery}
        maxLength={NAME_IN_DELIVERY_MAX}
        disabled={disabled}
        onChange={(event) => {
          onSettings({ nameInDelivery: event.target.value });
        }}
      />
      {SWITCHES.map(({ key, labelId }) => (
        <SwitchRow
          key={key}
          label={i18n._(labelId)}
          checked={form.settings[key]}
          disabled={disabled}
          onChange={(on) => {
            onSettings({ [key]: on });
          }}
        />
      ))}
      <QuantityRules {...props} onSettings={onSettings} />
      <SizeFields {...props} />
      <OrderManagersField {...props} />
    </div>
  );
}
