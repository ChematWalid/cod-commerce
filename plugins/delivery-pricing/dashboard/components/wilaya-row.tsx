import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import type { WilayaCode } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Badge, Button, Checkbox, Input, Switch } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { COMMUNES_SAVE_FIRST_TEST_ID, WILAYA_ROW_TEST_ID, WILAYA_SELECT_TEST_ID } from '../constants';
import { communePanelOf } from '../model/commune-form';
import { wilayaNameOf } from '../model/place-names';
import { type PricingRow, type RowChange, rowOverridden } from '../model/pricing-form';
import { CommunePanel } from './commune-panel';
import { LtrRun } from './ltr-run';

/** The shared grid of the wilaya rows and their header: stacked on a phone, one line from `md` up. */
export const WILAYA_GRID = 'grid gap-2 md:grid-cols-[minmax(9rem,1.4fr)_1fr_1fr_auto_auto_auto] md:items-center';

export interface WilayaRowProps {
  readonly row: PricingRow;
  readonly scope: StoreScope | null;
  /** The saved option's id; null on a new option, whose communes wait for the first save. */
  readonly groupId: string | null;
  readonly refused: boolean;
  readonly disabled: boolean;
  /** Communes of the wilaya explicitly switched on: they still deliver when it goes off (D3125). */
  readonly communesOn: number;
  readonly expanded: boolean;
  /** Ticked for "Raise/lower by…" (D3140). */
  readonly selected: boolean;
  readonly onSelect: (provinceCode: WilayaCode, on: boolean) => void;
  readonly onExpand: (provinceCode: WilayaCode) => void;
  readonly onChange: (provinceCode: WilayaCode, change: RowChange) => void;
  readonly onReset: (provinceCode: WilayaCode) => void;
}

function PriceInput(props: {
  label: string;
  value: string;
  refused: boolean;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const { i18n } = useLingui();
  return (
    <label className="grid gap-1">
      <span className="text-muted-foreground text-xs md:sr-only">{props.label}</span>
      <Input
        dir="ltr"
        inputMode="numeric"
        aria-label={props.label}
        aria-invalid={props.refused}
        title={props.refused ? i18n._('delivery-pricing.error-price') : undefined}
        disabled={props.disabled}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
    </label>
  );
}

function SwitchCell(props: { label: string; checked: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
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

type NameCellProps = Pick<WilayaRowProps, 'row' | 'disabled' | 'selected' | 'onSelect' | 'onReset'>;

function NameCell({ row, disabled, selected, onSelect, onReset }: NameCellProps): ReactNode {
  const { i18n } = useLingui();
  const overridden = rowOverridden(row);
  const name = wilayaNameOf(row.provinceCode, i18n.locale);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Checkbox
        data-testid={WILAYA_SELECT_TEST_ID}
        aria-label={`${i18n._('delivery-pricing.select-wilaya')}: ${name}`}
        checked={selected}
        disabled={disabled}
        onCheckedChange={(on) => {
          onSelect(row.provinceCode, on);
        }}
      />
      <LtrRun>{row.provinceCode}</LtrRun>
      <span className="font-medium">{name}</span>
      {overridden && <Badge variant="warning">{i18n._('delivery-pricing.overridden')}</Badge>}
      {overridden && !disabled && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            onReset(row.provinceCode);
          }}
        >
          {i18n._('delivery-pricing.reset-default')}
        </Button>
      )}
    </div>
  );
}

function RowNotes(props: WilayaRowProps): ReactNode {
  const { i18n } = useLingui();
  const { row } = props;
  const panel = communePanelOf(props.groupId);
  return (
    <>
      {props.refused && (
        <p role="alert" className="text-destructive text-xs md:col-span-full">
          {i18n._('delivery-pricing.error-price')}
        </p>
      )}
      {!row.deliveryEnabled && props.communesOn > 0 && (
        <p role="status" className="text-warning text-xs md:col-span-full">
          {i18n._('delivery-pricing.communes-still-on', { count: props.communesOn })}
        </p>
      )}
      {props.expanded && props.groupId !== null && panel === 'editable' && (
        <div className="md:col-span-full">
          <CommunePanel scope={props.scope} groupId={props.groupId} wilaya={row} disabled={props.disabled} />
        </div>
      )}
      {props.expanded && panel === 'save-first' && (
        <p data-testid={COMMUNES_SAVE_FIRST_TEST_ID} className="text-muted-foreground text-xs md:col-span-full">
          {i18n._('delivery-pricing.communes-save-first')}
        </p>
      )}
    </>
  );
}

type CellProps = Pick<WilayaRowProps, 'row' | 'refused' | 'disabled' | 'onChange'>;

/** The home and desk prices of the wilaya. */
function PriceCells({ row, refused, disabled, onChange }: CellProps): ReactNode {
  const { i18n } = useLingui();
  const code = row.provinceCode;
  return (
    <>
      <PriceInput
        label={i18n._('delivery-pricing.column-home')}
        value={row.homePrice}
        refused={refused}
        disabled={disabled}
        onChange={(homePrice) => {
          onChange(code, { homePrice });
        }}
      />
      <PriceInput
        label={i18n._('delivery-pricing.column-desk')}
        value={row.deskPrice}
        refused={refused}
        disabled={disabled}
        onChange={(deskPrice) => {
          onChange(code, { deskPrice });
        }}
      />
    </>
  );
}

/** The delivery and stop-desk switches of the wilaya. */
function SwitchCells({ row, disabled, onChange }: Omit<CellProps, 'refused'>): ReactNode {
  const { i18n } = useLingui();
  const code = row.provinceCode;
  return (
    <>
      <SwitchCell
        label={i18n._('delivery-pricing.column-delivery')}
        checked={row.deliveryEnabled}
        disabled={disabled}
        onChange={(deliveryEnabled) => {
          onChange(code, { deliveryEnabled });
        }}
      />
      <SwitchCell
        label={i18n._('delivery-pricing.column-desk-switch')}
        checked={row.deskEnabled}
        disabled={disabled}
        onChange={(deskEnabled) => {
          onChange(code, { deskEnabled });
        }}
      />
    </>
  );
}

/** One wilaya: code and name, home and desk prices, its delivery and desk switches, and its communes on demand. */
export function WilayaRow(props: WilayaRowProps): ReactNode {
  const { i18n } = useLingui();
  const { row, disabled } = props;
  return (
    <div
      data-testid={WILAYA_ROW_TEST_ID}
      data-province-code={row.provinceCode}
      className={`${WILAYA_GRID} border-b py-3`}
    >
      <NameCell
        row={row}
        disabled={disabled}
        selected={props.selected}
        onSelect={props.onSelect}
        onReset={props.onReset}
      />
      <PriceCells row={row} refused={props.refused} disabled={disabled} onChange={props.onChange} />
      <SwitchCells row={row} disabled={disabled} onChange={props.onChange} />
      <Button
        size="sm"
        variant="outline"
        aria-expanded={props.expanded}
        onClick={() => {
          props.onExpand(row.provinceCode);
        }}
      >
        {i18n._('delivery-pricing.communes')}
      </Button>
      <RowNotes {...props} />
    </div>
  );
}
