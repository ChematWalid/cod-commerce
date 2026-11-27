import { FEE_GROUP_NAME_MAX } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';
import { PRICING_NAME_TEST_ID } from '../constants';
import type { PricingForm } from '../model/pricing-form';
import { FieldError, NumberField, SwitchField } from './form-fields';

/** The only carrier choice until carriers exist (P5.S1, D3109). */
const NO_CARRIER_VALUE = 'none';

export interface EditorCardProps {
  readonly form: PricingForm;
  readonly errors: ReadonlySet<string>;
  readonly disabled: boolean;
  readonly onChange: (change: Partial<PricingForm>) => void;
}

function NameField({ form, errors, disabled, onChange }: EditorCardProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{i18n._('delivery-pricing.field-name')}</Label>
      <Input
        id={id}
        data-testid={PRICING_NAME_TEST_ID}
        maxLength={FEE_GROUP_NAME_MAX}
        aria-invalid={errors.has('name')}
        disabled={disabled}
        value={form.name}
        onChange={(event) => {
          onChange({ name: event.target.value });
        }}
      />
      <FieldError shown={errors.has('name')} messageId="delivery-pricing.error-name" />
    </div>
  );
}

function CarrierField({ disabled }: { readonly disabled: boolean }): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{i18n._('delivery-pricing.field-carrier')}</Label>
      <Select value={NO_CARRIER_VALUE} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{i18n._('delivery-pricing.no-carrier')}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_CARRIER_VALUE}>{i18n._('delivery-pricing.no-carrier')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

type OverweightField = 'overweightAllowanceKg' | 'overweightRate';

/** The label of each overweight number. */
const OVERWEIGHT_LABEL_IDS: Readonly<Record<OverweightField, string>> = {
  overweightAllowanceKg: 'delivery-pricing.field-allowance',
  overweightRate: 'delivery-pricing.field-rate',
};

function OverweightNumber(props: EditorCardProps & { readonly field: OverweightField }): ReactNode {
  const { i18n } = useLingui();
  const { field, errors } = props;
  return (
    <div className="grid gap-1">
      <NumberField
        label={i18n._(OVERWEIGHT_LABEL_IDS[field])}
        value={props.form[field]}
        invalid={errors.has(field)}
        disabled={props.disabled}
        onChange={(value) => {
          props.onChange({ [field]: value });
        }}
      />
      <FieldError shown={errors.has(field)} messageId="delivery-pricing.error-number" />
    </div>
  );
}

function OverweightFields(props: EditorCardProps): ReactNode {
  const { i18n } = useLingui();
  const { form, errors, disabled, onChange } = props;
  // A refused number stays shown even with the charge off: the save checks it either way.
  const shown = form.chargeOverweight || errors.has('overweightAllowanceKg') || errors.has('overweightRate');
  return (
    <div className="grid gap-3">
      <SwitchField
        label={i18n._('delivery-pricing.field-charge-overweight')}
        hint={i18n._('delivery-pricing.field-charge-overweight-hint')}
        checked={form.chargeOverweight}
        disabled={disabled}
        onChange={(chargeOverweight) => {
          onChange({ chargeOverweight });
        }}
      />
      {shown && (
        <div className="grid gap-3 sm:grid-cols-2">
          <OverweightNumber {...props} field="overweightAllowanceKg" />
          <OverweightNumber {...props} field="overweightRate" />
        </div>
      )}
    </div>
  );
}

/** Name, carrier ("No carrier" until P5) and "Charge overweight to the customer" with its allowance and rate. */
export function SettingsCard(props: EditorCardProps): ReactNode {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <NameField {...props} />
        <CarrierField disabled={props.disabled} />
      </div>
      <OverweightFields {...props} />
    </div>
  );
}
