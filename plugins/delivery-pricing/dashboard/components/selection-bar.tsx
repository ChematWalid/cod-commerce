import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import type { WilayaCode } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button, Checkbox, Label } from '@vendure/dashboard';
import { type ReactNode, useId, useState } from 'react';
import { ADJUST_OPEN_TEST_ID, SELECT_ALL_TEST_ID } from '../constants';
import type { FeeGroupDto } from '../dto';
import { useAdjustPrices } from '../hooks/use-bulk-writes';
import { selectionStateOf, withAllSelected } from '../model/price-tools';
import { AdjustDialog } from './adjust-dialog';

interface SelectionBarProps {
  readonly scope: StoreScope | null;
  /** The saved option's id; null on a new option, whose prices are raised once saved. */
  readonly groupId: string | null;
  /** The wilaya rows of the table, in order: "Select all" ticks these. */
  readonly codes: readonly WilayaCode[];
  readonly selection: ReadonlySet<WilayaCode>;
  /** The table has edits not saved yet: the server adjusts the saved prices, so those would be lost. */
  readonly unsaved: boolean;
  readonly disabled: boolean;
  readonly onSelection: (selection: ReadonlySet<WilayaCode>) => void;
  readonly onAdjusted: (group: FeeGroupDto) => void;
}

function SelectAll({ codes, selection, disabled, onSelection }: SelectionBarProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  const state = selectionStateOf(selection, codes);
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        data-testid={SELECT_ALL_TEST_ID}
        checked={state === 'all'}
        indeterminate={state === 'some'}
        disabled={disabled}
        onCheckedChange={(on) => {
          onSelection(withAllSelected(codes, on));
        }}
      />
      <Label htmlFor={id} className="font-normal">
        {i18n._('delivery-pricing.select-all')}
      </Label>
      <span className="text-muted-foreground text-xs" aria-live="polite">
        {i18n._('delivery-pricing.selected-count', { count: selection.size })}
      </span>
    </div>
  );
}

/** Why "Raise/lower by…" waits, if it does: a new option or unsaved edits must be saved first. */
const waitingMessageIdOf = (props: SelectionBarProps): string | null =>
  props.groupId === null || props.unsaved ? 'delivery-pricing.save-first-bulk' : null;

/** The adjust button, its dialog and the write; the dialog resets each time it opens. */
function AdjustTool(props: SelectionBarProps & { readonly groupId: string }): ReactNode {
  const { i18n } = useLingui();
  const [open, setOpen] = useState(false);
  const adjust = useAdjustPrices({
    scope: props.scope,
    groupId: props.groupId,
    onDone: (group) => {
      setOpen(false);
      props.onAdjusted(group);
    },
  });
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        data-testid={ADJUST_OPEN_TEST_ID}
        disabled={props.disabled || props.unsaved || props.selection.size === 0}
        onClick={() => {
          setOpen(true);
        }}
      >
        {i18n._('delivery-pricing.adjust-open')}
      </Button>
      {open && (
        <AdjustDialog
          open
          selection={props.selection}
          pending={adjust.isPending}
          onApply={(input) => {
            adjust.mutate(input);
          }}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/** Above the wilaya rows: "Select all", how many are ticked, and "Raise/lower by…" for the ticked ones (D3140). */
export function SelectionBar(props: SelectionBarProps): ReactNode {
  const { i18n } = useLingui();
  const waiting = waitingMessageIdOf(props);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <SelectAll {...props} />
      <div className="flex flex-wrap items-center gap-2">
        {waiting !== null && !props.disabled && <p className="text-muted-foreground text-xs">{i18n._(waiting)}</p>}
        {props.groupId !== null && <AdjustTool {...props} groupId={props.groupId} />}
      </div>
    </div>
  );
}
