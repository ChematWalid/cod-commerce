import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { COMMUNE_PANEL_TEST_ID } from '../constants';
import type { CommuneRateDto } from '../dto';
import { useCommuneSave } from '../hooks/use-pricing-writes';
import {
  type CommuneChange,
  type CommuneRow as CommuneRowState,
  communeEditorKeyOf,
  communeRowsOf,
  withCommune,
  withCommuneReset,
} from '../model/commune-form';
import type { PricingRow } from '../model/pricing-form';
import { useFeeGroup, useTowns } from '../queries';
import { CommunePricesTool } from './commune-prices-tool';
import { CommuneRow } from './commune-row';

interface CommunePanelProps {
  readonly scope: StoreScope | null;
  readonly groupId: string;
  /** The wilaya row as typed, whose prices and switches the communes inherit. */
  readonly wilaya: PricingRow;
  readonly disabled: boolean;
}

interface CommuneEditorProps extends CommunePanelProps {
  readonly initial: readonly CommuneRowState[];
}

/** The communes as edited, with a change and a reset per commune. */
function useCommuneRows(initial: readonly CommuneRowState[]) {
  const [rows, setRows] = useState(initial);
  const onChange = (codeOns: number, change: CommuneChange): void => {
    setRows((current) => withCommune(current, codeOns, change));
  };
  const onReset = (codeOns: number): void => {
    setRows((current) => withCommuneReset(current, codeOns));
  };
  return { rows, onChange, onReset };
}

/** The communes as edited, the refused ones and their save. */
function CommuneEditor(props: CommuneEditorProps): ReactNode {
  const { i18n } = useLingui();
  const { rows, onChange, onReset } = useCommuneRows(props.initial);
  const [refused, setRefused] = useState<ReadonlySet<number>>(new Set());
  const save = useCommuneSave({
    scope: props.scope,
    groupId: props.groupId,
    provinceCode: props.wilaya.provinceCode,
    onErrors: setRefused,
  });
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <CommuneRow
          key={row.codeOns}
          row={row}
          wilaya={props.wilaya}
          refused={refused.has(row.codeOns)}
          disabled={props.disabled}
          onChange={onChange}
          onReset={onReset}
        />
      ))}
      {!props.disabled && (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={save.isPending}
            onClick={() => {
              save.mutate(rows);
            }}
          >
            {i18n._('delivery-pricing.communes-save')}
          </Button>
        </div>
      )}
    </div>
  );
}

const NO_COMMUNE_RATES: readonly CommuneRateDto[] = [];

/**
 * The communes of one wilaya of a saved pricing option (D3125): the towns come from the public reference data, the
 * stored commune rows from the option; saving merges them through `setDeliveryFeeCommuneRates`.
 */
export function CommunePanel(props: CommunePanelProps): ReactNode {
  const { i18n } = useLingui();
  const towns = useTowns(props.wilaya.provinceCode);
  const group = useFeeGroup(props.scope, props.groupId);
  const stored = group.data?.communeRates ?? NO_COMMUNE_RATES;
  const own = stored.filter((row) => row.provinceCode === props.wilaya.provinceCode);
  let body: ReactNode;
  if (towns.isError || group.isError) body = <p role="alert">{i18n._('delivery-pricing.error-generic')}</p>;
  else if (towns.data === undefined || group.data === undefined) body = <p>{i18n._('delivery-pricing.loading')}</p>;
  else if (group.data === null) body = <p role="alert">{i18n._('delivery-pricing.not-found-page')}</p>;
  else {
    const key = communeEditorKeyOf(group.data.updatedAt, own);
    body = <CommuneEditor key={key} {...props} initial={communeRowsOf(towns.data, own)} />;
  }
  return (
    <div data-testid={COMMUNE_PANEL_TEST_ID} className="bg-muted/40 rounded-md p-3">
      {!props.disabled && (
        <CommunePricesTool scope={props.scope} groupId={props.groupId} provinceCode={props.wilaya.provinceCode} />
      )}
      <p className="text-muted-foreground my-2 text-xs">{i18n._('delivery-pricing.communes-hint')}</p>
      {body}
    </div>
  );
}
