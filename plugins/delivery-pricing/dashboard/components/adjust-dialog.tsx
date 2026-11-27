import type { DeliveryFeePriceAdjustmentInput, WilayaCode } from '@cod/shared';
import { useLingui } from '@lingui/react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  RadioGroup,
  RadioGroupItem,
} from '@vendure/dashboard';
import { type ReactNode, useId, useState } from 'react';
import { ADJUST_APPLY_TEST_ID, ADJUST_DIALOG_TEST_ID, ADJUST_VALUE_TEST_ID } from '../constants';
import { type AdjustForm, adjustmentInputOf, INITIAL_ADJUST_FORM } from '../model/price-tools';
import { NumberField } from './form-fields';

interface AdjustDialogProps {
  readonly open: boolean;
  readonly selection: ReadonlySet<WilayaCode>;
  readonly pending: boolean;
  readonly onApply: (input: DeliveryFeePriceAdjustmentInput) => void;
  readonly onClose: () => void;
}

/** One labelled radio group whose values are the keys of `labelIds`. */
function Choice<Value extends string>(props: {
  readonly legendId: string;
  readonly value: Value;
  readonly labelIds: Readonly<Record<Value, string>>;
  readonly onChange: (value: Value) => void;
}): ReactNode {
  const { i18n } = useLingui();
  const baseId = useId();
  const values = Object.keys(props.labelIds) as Value[];
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{i18n._(props.legendId)}</legend>
      <RadioGroup
        value={props.value}
        className="flex flex-wrap gap-4"
        onValueChange={(next) => {
          const chosen = values.find((value) => value === next);
          if (chosen !== undefined) props.onChange(chosen);
        }}
      >
        {values.map((value) => (
          <div key={value} className="flex items-center gap-2">
            <RadioGroupItem id={`${baseId}-${value}`} value={value} />
            <Label htmlFor={`${baseId}-${value}`} className="font-normal">
              {i18n._(props.labelIds[value])}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

function Tick(props: { readonly label: string; readonly checked: boolean; readonly onChange: (on: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={props.checked}
        onCheckedChange={(on) => {
          props.onChange(on);
        }}
      />
      <Label htmlFor={id} className="font-normal">
        {props.label}
      </Label>
    </div>
  );
}

const DIRECTION_LABELS = { raise: 'delivery-pricing.adjust-raise', lower: 'delivery-pricing.adjust-lower' } as const;
const KIND_LABELS = { amount: 'delivery-pricing.adjust-amount', percent: 'delivery-pricing.adjust-percent' } as const;

/** Which prices move: home, desk, and whether the commune overrides move too. */
function AdjustTicks(props: { readonly form: AdjustForm; readonly onChange: (change: Partial<AdjustForm>) => void }) {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-2">
      <Tick
        label={i18n._('delivery-pricing.column-home')}
        checked={props.form.home}
        onChange={(home) => {
          props.onChange({ home });
        }}
      />
      <Tick
        label={i18n._('delivery-pricing.column-desk')}
        checked={props.form.desk}
        onChange={(desk) => {
          props.onChange({ desk });
        }}
      />
      <Tick
        label={i18n._('delivery-pricing.adjust-include-communes')}
        checked={props.form.includeCommunes}
        onChange={(includeCommunes) => {
          props.onChange({ includeCommunes });
        }}
      />
    </div>
  );
}

/** The dialog's fields: direction, DZD or %, the value, which prices, and whether commune overrides move too. */
function AdjustFields({ form, onForm }: { readonly form: AdjustForm; readonly onForm: (form: AdjustForm) => void }) {
  const { i18n } = useLingui();
  const set = (change: Partial<AdjustForm>): void => {
    onForm({ ...form, ...change });
  };
  return (
    <div className="grid gap-4">
      <Choice
        legendId="delivery-pricing.adjust-direction"
        value={form.direction}
        labelIds={DIRECTION_LABELS}
        onChange={(direction) => {
          set({ direction });
        }}
      />
      <Choice
        legendId="delivery-pricing.adjust-kind"
        value={form.kind}
        labelIds={KIND_LABELS}
        onChange={(kind) => {
          set({ kind });
        }}
      />
      <NumberField
        label={i18n._('delivery-pricing.adjust-value')}
        testId={ADJUST_VALUE_TEST_ID}
        value={form.value}
        disabled={false}
        onChange={(value) => {
          set({ value });
        }}
      />
      <AdjustTicks form={form} onChange={set} />
      <p className="text-muted-foreground text-xs">{i18n._('delivery-pricing.adjust-communes-note')}</p>
    </div>
  );
}

/** Cancel and apply; `onApply` is null while the form is not valid. */
function AdjustFooter(props: {
  readonly pending: boolean;
  readonly onApply: (() => void) | null;
  readonly onClose: () => void;
}): ReactNode {
  const { i18n } = useLingui();
  const { onApply } = props;
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={props.onClose}>
        {i18n._('delivery-pricing.cancel')}
      </Button>
      <Button
        type="button"
        data-testid={ADJUST_APPLY_TEST_ID}
        disabled={props.pending || onApply === null}
        onClick={() => {
          onApply?.();
        }}
      >
        {i18n._('delivery-pricing.adjust-apply')}
      </Button>
    </DialogFooter>
  );
}

/**
 * "Raise/lower by…" (D3140): moves the selected wilayas' prices by DZD or %, rounded to the dinar and never below 0.
 * The note says commune prices set by hand stay unless "Include communes" is ticked.
 */
export function AdjustDialog({ open, selection, pending, onApply, onClose }: AdjustDialogProps): ReactNode {
  const { i18n } = useLingui();
  const [form, setForm] = useState(INITIAL_ADJUST_FORM);
  const submit = adjustmentInputOf(form, selection);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent data-testid={ADJUST_DIALOG_TEST_ID}>
        <DialogHeader>
          <DialogTitle>{i18n._('delivery-pricing.adjust-heading')}</DialogTitle>
          <DialogDescription>{i18n._('delivery-pricing.adjust-body', { count: selection.size })}</DialogDescription>
        </DialogHeader>
        <AdjustFields form={form} onForm={setForm} />
        {!submit.ok && form.value.trim() !== '' && (
          <p role="alert" className="text-destructive text-xs">
            {i18n._('delivery-pricing.adjust-invalid')}
          </p>
        )}
        <AdjustFooter
          pending={pending}
          onApply={
            submit.ok
              ? () => {
                  onApply(submit.input);
                }
              : null
          }
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
