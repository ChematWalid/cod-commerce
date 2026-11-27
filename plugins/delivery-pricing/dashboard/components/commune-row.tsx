import { useLingui } from '@lingui/react';
import { Badge, Button, Input, Switch } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { COMMUNE_ROW_TEST_ID } from '../constants';
import {
  type CommuneChange,
  type CommuneRow as CommuneRowState,
  communeOverridden,
  effectiveSwitchOf,
  fallbackPriceOf,
} from '../model/commune-form';
import { townNameOf } from '../model/place-names';
import type { PricingRow } from '../model/pricing-form';
import { LtrRun } from './ltr-run';

/** The commune rows' grid: stacked on a phone, one line from `md` up. */
export const COMMUNE_GRID = 'grid gap-2 md:grid-cols-[minmax(8rem,1.4fr)_1fr_1fr_auto_auto] md:items-center';

export interface CommuneRowProps {
  readonly row: CommuneRowState;
  /** The wilaya row, whose prices and switches a commune inherits. */
  readonly wilaya: PricingRow;
  readonly refused: boolean;
  readonly disabled: boolean;
  readonly onChange: (codeOns: number, change: CommuneChange) => void;
  readonly onReset: (codeOns: number) => void;
}

interface CommunePriceProps {
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly refused: boolean;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
}

/** A commune price: blank inherits, and the price it falls back to shows as the placeholder. */
function CommunePrice({ label, refused, onChange, ...rest }: CommunePriceProps): ReactNode {
  return (
    <label className="grid gap-1">
      <span className="text-muted-foreground text-xs md:sr-only">{label}</span>
      <Input
        dir="ltr"
        inputMode="numeric"
        aria-label={label}
        aria-invalid={refused}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        {...rest}
      />
    </label>
  );
}

function CommuneSwitch(props: { label: string; checked: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 md:justify-center">
      <span className="text-muted-foreground text-xs md:sr-only">{props.label}</span>
      <Switch
        aria-label={props.label}
        checked={props.checked}
        disabled={props.disabled}
        onCheckedChange={(on) => {
          props.onChange(on);
        }}
      />
    </label>
  );
}

function CommuneName({ row, disabled, onReset }: Pick<CommuneRowProps, 'row' | 'disabled' | 'onReset'>): ReactNode {
  const { i18n } = useLingui();
  const overridden = communeOverridden(row);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <LtrRun>{String(row.codeOns)}</LtrRun>
      <span>{townNameOf(row, i18n.locale)}</span>
      {overridden && <Badge variant="warning">{i18n._('delivery-pricing.overridden')}</Badge>}
      {overridden && !disabled && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onReset(row.codeOns);
          }}
        >
          {i18n._('delivery-pricing.reset-default')}
        </Button>
      )}
    </div>
  );
}

type CellProps = Omit<CommuneRowProps, 'onReset'>;

/** The commune's own home and desk prices; the placeholders show what a blank one falls back to. */
function CommunePrices({ row, wilaya, refused, disabled, onChange }: CellProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <>
      <CommunePrice
        label={i18n._('delivery-pricing.column-home')}
        value={row.homePrice}
        refused={refused}
        placeholder={fallbackPriceOf(row.baseHomePrice, wilaya.homePrice)}
        disabled={disabled}
        onChange={(homePrice) => {
          onChange(row.codeOns, { homePrice });
        }}
      />
      <CommunePrice
        label={i18n._('delivery-pricing.column-desk')}
        value={row.deskPrice}
        refused={refused}
        placeholder={fallbackPriceOf(row.baseDeskPrice, wilaya.deskPrice)}
        disabled={disabled}
        onChange={(deskPrice) => {
          onChange(row.codeOns, { deskPrice });
        }}
      />
    </>
  );
}

/** The switches as they act (own value, else the wilaya's); a commune without a stop desk keeps its desk off. */
function CommuneSwitches({ row, wilaya, disabled, onChange }: Omit<CellProps, 'refused'>): ReactNode {
  const { i18n } = useLingui();
  return (
    <>
      <CommuneSwitch
        label={i18n._('delivery-pricing.column-delivery')}
        disabled={disabled}
        checked={effectiveSwitchOf(row.deliveryEnabled, wilaya.deliveryEnabled)}
        onChange={(deliveryEnabled) => {
          onChange(row.codeOns, { deliveryEnabled });
        }}
      />
      <CommuneSwitch
        label={i18n._('delivery-pricing.column-desk-switch')}
        disabled={disabled || !row.isStopdesk}
        checked={row.isStopdesk && effectiveSwitchOf(row.deskEnabled, wilaya.deskEnabled)}
        onChange={(deskEnabled) => {
          onChange(row.codeOns, { deskEnabled });
        }}
      />
    </>
  );
}

/** One commune: its own home and desk prices (blank = inherit) and its delivery and desk switches (D3125). */
export function CommuneRow({ onReset, ...props }: CommuneRowProps): ReactNode {
  const { row } = props;
  return (
    <div data-testid={COMMUNE_ROW_TEST_ID} data-code-ons={row.codeOns} className={`${COMMUNE_GRID} border-b py-2`}>
      <CommuneName row={row} disabled={props.disabled} onReset={onReset} />
      <CommunePrices {...props} />
      <CommuneSwitches {...props} />
    </div>
  );
}
