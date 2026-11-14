import { SOLD_OUT_BEHAVIORS, type SoldOutBehavior } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Label, RadioGroup, RadioGroupItem, Switch } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';
import { soldOutOptionTestId, STORE_SHOW_ADDRESS_TEST_ID, STORE_SOLD_OUT_TEST_ID } from '../constants';

/** The sentence of each sold-out behaviour. */
const SOLD_OUT_LABEL_IDS: Readonly<Record<SoldOutBehavior, string>> = {
  keep: 'shell.settings.store.sold-out-keep',
  hide: 'shell.settings.store.sold-out-hide',
};

const isSoldOutBehavior = (value: unknown): value is SoldOutBehavior =>
  typeof value === 'string' && (SOLD_OUT_BEHAVIORS as readonly string[]).includes(value);

interface OperationsFieldsProps {
  readonly showAddressField: boolean;
  readonly soldOutBehavior: SoldOutBehavior;
  readonly disabled: boolean;
  readonly onChange: (patch: { showAddressField?: boolean; soldOutBehavior?: SoldOutBehavior }) => void;
}

/** Whether the storefront's checkout asks for an address. */
function ShowAddressField({
  checked,
  disabled,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (checked: boolean) => void;
}): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{i18n._('shell.settings.store.show-address')}</Label>
        <p className="text-muted-foreground text-xs">{i18n._('shell.settings.store.show-address-hint')}</p>
      </div>
      <Switch
        id={id}
        data-testid={STORE_SHOW_ADDRESS_TEST_ID}
        className="shrink-0"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}

/** Keep showing sold-out products with a mark, or hide them from lists and product pages (D2109). */
function SoldOutField({
  value,
  disabled,
  onChange,
}: {
  readonly value: SoldOutBehavior;
  readonly disabled: boolean;
  readonly onChange: (value: SoldOutBehavior) => void;
}): ReactNode {
  const { i18n } = useLingui();
  const baseId = useId();
  return (
    <fieldset className="grid gap-2" data-testid={STORE_SOLD_OUT_TEST_ID}>
      <legend className="mb-1 text-sm font-medium">{i18n._('shell.settings.store.sold-out')}</legend>
      <RadioGroup
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          if (isSoldOutBehavior(next)) onChange(next);
        }}
      >
        {SOLD_OUT_BEHAVIORS.map((behavior) => (
          <div key={behavior} className="flex items-center gap-2">
            <RadioGroupItem id={`${baseId}-${behavior}`} data-testid={soldOutOptionTestId(behavior)} value={behavior} />
            <Label htmlFor={`${baseId}-${behavior}`} className="font-normal">
              {i18n._(SOLD_OUT_LABEL_IDS[behavior])}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}

/**
 * The store's operations settings P2.S1 owns (D2120): the address field and sold-out products. The default delivery
 * fee group (P3.S1) and the default carrier (P5.S1) join here once their data exists.
 */
export function StoreOperationsFields({
  showAddressField,
  soldOutBehavior,
  disabled,
  onChange,
}: OperationsFieldsProps): ReactNode {
  return (
    <>
      <ShowAddressField
        checked={showAddressField}
        disabled={disabled}
        onChange={(checked) => {
          onChange({ showAddressField: checked });
        }}
      />
      <SoldOutField
        value={soldOutBehavior}
        disabled={disabled}
        onChange={(behavior) => {
          onChange({ soldOutBehavior: behavior });
        }}
      />
    </>
  );
}
