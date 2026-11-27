import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import {
  APPLY_ALL_TEST_ID,
  APPLY_DESK_TEST_ID,
  APPLY_HOME_TEST_ID,
  DELIVER_EVERYWHERE_TEST_ID,
  DESK_EVERYWHERE_TEST_ID,
} from '../constants';
import {
  type ApplyToAll,
  deliversEverywhere,
  deskEverywhere,
  withApplyToAll,
  withDeliverEverywhere,
  withDeskEverywhere,
} from '../model/pricing-bulk';
import type { PricingForm } from '../model/pricing-form';
import { NumberField, SwitchField } from './form-fields';

interface BulkCardProps {
  readonly form: PricingForm;
  readonly disabled: boolean;
  /** Replaces the whole form: the bulk tools change every row at once. */
  readonly onForm: (form: PricingForm) => void;
}

function ApplyToAllRow({ form, disabled, onForm }: BulkCardProps): ReactNode {
  const { i18n } = useLingui();
  const [prices, setPrices] = useState<ApplyToAll>({ home: '', desk: '' });
  return (
    <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <NumberField
        label={i18n._('delivery-pricing.column-home')}
        testId={APPLY_HOME_TEST_ID}
        value={prices.home}
        disabled={disabled}
        onChange={(home) => {
          setPrices((current) => ({ ...current, home }));
        }}
      />
      <NumberField
        label={i18n._('delivery-pricing.column-desk')}
        testId={APPLY_DESK_TEST_ID}
        value={prices.desk}
        disabled={disabled}
        onChange={(desk) => {
          setPrices((current) => ({ ...current, desk }));
        }}
      />
      <Button
        variant="outline"
        data-testid={APPLY_ALL_TEST_ID}
        disabled={disabled || (prices.home.trim() === '' && prices.desk.trim() === '')}
        onClick={() => {
          onForm(withApplyToAll(form, prices));
        }}
      >
        {i18n._('delivery-pricing.apply-to-all')}
      </Button>
    </div>
  );
}

/** "Apply to all" and the two master toggles: "Deliver to every wilaya", "Stop desk in every delivered wilaya". */
export function BulkCard(props: BulkCardProps): ReactNode {
  const { i18n } = useLingui();
  const { form, disabled, onForm } = props;
  return (
    <div className="grid gap-4">
      <ApplyToAllRow {...props} />
      <SwitchField
        label={i18n._('delivery-pricing.deliver-everywhere')}
        testId={DELIVER_EVERYWHERE_TEST_ID}
        checked={deliversEverywhere(form)}
        disabled={disabled}
        onChange={(on) => {
          onForm(withDeliverEverywhere(form, on));
        }}
      />
      <SwitchField
        label={i18n._('delivery-pricing.desk-everywhere')}
        testId={DESK_EVERYWHERE_TEST_ID}
        checked={deskEverywhere(form)}
        disabled={disabled}
        onChange={(on) => {
          onForm(withDeskEverywhere(form, on));
        }}
      />
    </div>
  );
}
