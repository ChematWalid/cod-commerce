import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import type { WilayaCode } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { type ReactNode, useState } from 'react';
import type { CommuneRateDto } from '../dto';
import { communesSwitchedOn } from '../model/commune-form';
import { type PricingForm, type RowChange, withRow, withRowReset } from '../model/pricing-form';
import { WILAYA_GRID, WilayaRow } from './wilaya-row';

interface WilayaTableProps {
  readonly form: PricingForm;
  readonly errors: ReadonlySet<string>;
  readonly disabled: boolean;
  readonly scope: StoreScope | null;
  readonly groupId: string | null;
  /** The option's stored commune rows, for the warning when a wilaya goes off; none on a new option. */
  readonly communeRates: readonly CommuneRateDto[];
  readonly onForm: (update: (form: PricingForm) => PricingForm) => void;
}

/** The column titles, from `md` up; on a phone each field carries its own label. */
function HeaderRow(): ReactNode {
  const { i18n } = useLingui();
  const head = (id: string): ReactNode => (
    <span className="text-muted-foreground text-xs font-medium">{i18n._(id)}</span>
  );
  return (
    <div className={`${WILAYA_GRID} hidden border-b pb-2 md:grid`} aria-hidden="true">
      {head('delivery-pricing.column-wilaya')}
      {head('delivery-pricing.column-home')}
      {head('delivery-pricing.column-desk')}
      {head('delivery-pricing.column-delivery')}
      {head('delivery-pricing.column-desk-switch')}
      {head('delivery-pricing.communes')}
    </div>
  );
}

/** "Prices by wilaya": one row per wilaya of `WILAYAS`, each expandable to its communes on a saved option. */
export function WilayaTable(props: WilayaTableProps): ReactNode {
  const [expanded, setExpanded] = useState<WilayaCode | null>(null);
  const onChange = (code: WilayaCode, change: RowChange): void => {
    props.onForm((form) => withRow(form, code, change));
  };
  const onReset = (code: WilayaCode): void => {
    props.onForm((form) => withRowReset(form, code));
  };
  return (
    <div className="grid">
      <HeaderRow />
      {props.form.rows.map((row) => (
        <WilayaRow
          key={row.provinceCode}
          row={row}
          scope={props.scope}
          groupId={props.groupId}
          refused={props.errors.has(`rate:${row.provinceCode}`)}
          disabled={props.disabled}
          communesOn={communesSwitchedOn(props.communeRates, row.provinceCode)}
          expanded={expanded === row.provinceCode}
          onExpand={(code) => {
            setExpanded((current) => (current === code ? null : code));
          }}
          onChange={onChange}
          onReset={onReset}
        />
      ))}
    </div>
  );
}
