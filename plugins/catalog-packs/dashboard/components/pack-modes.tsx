import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { PACK_PRICING_MODES, PACK_VARIANT_MODES, PACK_WEIGHT_MODES } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';
import { PACK_DISCOUNT_VALUE_TEST_ID } from '../constants';
import { type PackDiscountChoice, type PackForm, type PackFormErrors, packFieldDisabled } from '../model/pack-form';

/** What each part of the pack form gets from the block. */
export interface PackFormProps {
  readonly form: PackForm;
  readonly errors: PackFormErrors;
  readonly disabled: boolean;
  readonly onChange: (change: Partial<PackForm>) => void;
}

const DISCOUNT_CHOICES: readonly PackDiscountChoice[] = ['none', 'percent', 'amount'];

const PRICING_LABEL_IDS = { fixed: 'packs.pricing-fixed', components_sum: 'packs.pricing-sum' } as const;
const DISCOUNT_LABEL_IDS = {
  none: 'packs.discount-none',
  percent: 'packs.discount-percent',
  amount: 'packs.discount-amount',
} as const;
const VARIANT_LABEL_IDS = {
  per_component: 'packs.variant-per-component',
  shared_option: 'packs.variant-shared',
} as const;
const WEIGHT_LABEL_IDS = { components_sum: 'packs.weight-sum', fixed: 'packs.weight-fixed' } as const;

interface ModeSelectProps<T extends string> {
  readonly labelId: string;
  readonly value: T;
  readonly choices: readonly T[];
  readonly labelIds: Readonly<Record<T, string>>;
  readonly disabled: boolean;
  readonly onChange: (value: T) => void;
}

/** One labelled choice among a mode's words. */
function ModeSelect<T extends string>(props: ModeSelectProps<T>): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{i18n._(props.labelId)}</Label>
      <Select
        value={props.value}
        disabled={props.disabled}
        onValueChange={(value) => {
          const chosen = props.choices.find((choice) => choice === value);
          if (chosen !== undefined) props.onChange(chosen);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{i18n._(props.labelIds[props.value])}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {props.choices.map((choice) => (
            <SelectItem key={choice} value={choice}>
              {i18n._(props.labelIds[choice])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Price mode, then the fixed price or the discount it uses. */
function PricingFields({ form, errors, disabled, onChange }: PackFormProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <ModeSelect
        labelId="packs.pricing-mode"
        value={form.pricingMode}
        choices={PACK_PRICING_MODES}
        labelIds={PRICING_LABEL_IDS}
        disabled={disabled}
        onChange={(pricingMode) => {
          onChange({ pricingMode });
        }}
      />
      {form.pricingMode === 'fixed' ? (
        <TextField
          label={i18n._('packs.fixed-price')}
          inputMode="numeric"
          value={form.fixedPrice}
          suffix={i18n._('packs.currency')}
          errorId={errors.fixedPrice}
          disabled={packFieldDisabled(form, 'fixedPrice', disabled)}
          onChange={(event) => {
            onChange({ fixedPrice: event.target.value });
          }}
        />
      ) : (
        <DiscountFields form={form} errors={errors} disabled={disabled} onChange={onChange} />
      )}
    </div>
  );
}

/** The discount of a summed pack: its kind and its value. */
function DiscountFields({ form, errors, disabled, onChange }: PackFormProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <>
      <ModeSelect
        labelId="packs.discount-type"
        value={form.discountType}
        choices={DISCOUNT_CHOICES}
        labelIds={DISCOUNT_LABEL_IDS}
        disabled={packFieldDisabled(form, 'discountType', disabled)}
        onChange={(discountType) => {
          onChange({ discountType });
        }}
      />
      <TextField
        label={i18n._('packs.discount-value')}
        inputMode="numeric"
        data-testid={PACK_DISCOUNT_VALUE_TEST_ID}
        value={form.discountValue}
        suffix={form.discountType === 'percent' ? '%' : i18n._('packs.currency')}
        errorId={errors.discountValue}
        disabled={packFieldDisabled(form, 'discountValue', disabled)}
        onChange={(event) => {
          onChange({ discountValue: event.target.value });
        }}
      />
    </>
  );
}

/** Variant mode and, for a shared option, its name. */
function VariantFields({ form, errors, disabled, onChange }: PackFormProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <ModeSelect
        labelId="packs.variant-mode"
        value={form.variantMode}
        choices={PACK_VARIANT_MODES}
        labelIds={VARIANT_LABEL_IDS}
        disabled={disabled}
        onChange={(variantMode) => {
          onChange({ variantMode });
        }}
      />
      {form.variantMode === 'shared_option' && (
        <TextField
          label={i18n._('packs.shared-option')}
          value={form.sharedOption}
          errorId={errors.sharedOption}
          disabled={packFieldDisabled(form, 'sharedOption', disabled)}
          onChange={(event) => {
            onChange({ sharedOption: event.target.value });
          }}
        />
      )}
    </div>
  );
}

/** Weight mode and, for a fixed weight, its grams. */
function WeightFields({ form, errors, disabled, onChange }: PackFormProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <ModeSelect
        labelId="packs.weight-mode"
        value={form.weightMode}
        choices={PACK_WEIGHT_MODES}
        labelIds={WEIGHT_LABEL_IDS}
        disabled={disabled}
        onChange={(weightMode) => {
          onChange({ weightMode });
        }}
      />
      {form.weightMode === 'fixed' && (
        <TextField
          label={i18n._('packs.fixed-weight')}
          inputMode="numeric"
          value={form.fixedWeight}
          suffix={i18n._('packs.grams')}
          errorId={errors.fixedWeight}
          disabled={packFieldDisabled(form, 'fixedWeight', disabled)}
          onChange={(event) => {
            onChange({ fixedWeight: event.target.value });
          }}
        />
      )}
    </div>
  );
}

/** The pack's pricing, discount, variant and weight modes (D2202). */
export function PackModes(props: PackFormProps): ReactNode {
  return (
    <div className="grid gap-4">
      <PricingFields {...props} />
      <VariantFields {...props} />
      <WeightFields {...props} />
    </div>
  );
}
