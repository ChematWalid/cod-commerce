import { useLingui } from '@lingui/react';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { commissionNoticeIdOf, commissionValueText } from '../commission-draft';
import type { CommissionBasisDto, CommissionConfigDto } from '../dto';
import { basisLabelOf, formatDzd, useUiLanguage } from '../labels';
import { CommissionInlineForm } from './commission-inline-form';
import { LtrRun } from './ltr-run';

interface CommissionPickerProps {
  readonly configs: readonly CommissionConfigDto[];
  readonly bases: readonly CommissionBasisDto[];
  readonly selected: readonly string[];
  /** Whether the caller holds `team.commissions.view`; without it only a neutral notice shows. */
  readonly canSee: boolean;
  /** Whether the caller holds `team.commissions.set`, which the inline form needs. */
  readonly canCreate: boolean;
  readonly onChange: (selected: readonly string[]) => void;
}

function ValueText({ config }: { readonly config: CommissionConfigDto }): ReactNode {
  const { i18n } = useLingui();
  const language = useUiLanguage();
  if (config.valueKind === 'percent') return <LtrRun>{`${commissionValueText('percent', config.value)} %`}</LtrRun>;
  return i18n._('team.amount-dzd', { amount: formatDzd(config.value, language) });
}

function ChosenRow(
  props: { readonly config: CommissionConfigDto; readonly bases: readonly CommissionBasisDto[] } & {
    readonly onRemove: () => void;
  },
): ReactNode {
  const { i18n } = useLingui();
  const language = useUiLanguage();
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm">
      <span className="grid [overflow-wrap:anywhere]">
        <span className="font-medium">{props.config.name}</span>
        <span className="text-muted-foreground text-xs">
          {basisLabelOf(props.config.basis, props.bases, language)} · <ValueText config={props.config} />
        </span>
      </span>
      <Button type="button" size="sm" variant="ghost" onClick={props.onRemove}>
        {i18n._('team.commission-remove')}
      </Button>
    </li>
  );
}

function AddCommission(props: {
  readonly options: readonly CommissionConfigDto[];
  readonly onAdd: (id: string) => void;
}) {
  const { i18n } = useLingui();
  return (
    <Select
      value={null}
      onValueChange={(id) => {
        if (typeof id === 'string') props.onAdd(id);
      }}
    >
      <SelectTrigger className="w-full" aria-label={i18n._('team.commission-add')}>
        <SelectValue>{i18n._('team.commission-add')}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {props.options.map((config) => (
          <SelectItem key={config.id} value={config.id}>
            {config.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface CreatorProps {
  readonly bases: readonly CommissionBasisDto[];
  readonly onCreated: (config: CommissionConfigDto) => void;
}

/** "Create a commission structure", opening the inline form in place. */
function CommissionCreator({ bases, onCreated }: CreatorProps): ReactNode {
  const { i18n } = useLingui();
  const [creating, setCreating] = useState(false);
  if (!creating) {
    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        className="justify-self-start"
        onClick={() => {
          setCreating(true);
        }}
      >
        {i18n._('team.commission-new')}
      </Button>
    );
  }
  return (
    <CommissionInlineForm
      bases={bases}
      onCancel={() => {
        setCreating(false);
      }}
      onCreated={(config) => {
        setCreating(false);
        onCreated(config);
      }}
    />
  );
}

function ChosenList(props: {
  readonly chosen: readonly CommissionConfigDto[];
  readonly bases: readonly CommissionBasisDto[];
  readonly onRemove: (id: string) => void;
}): ReactNode {
  return (
    <ul className="grid gap-1">
      {props.chosen.map((config) => (
        <ChosenRow
          key={config.id}
          config={config}
          bases={props.bases}
          onRemove={() => {
            props.onRemove(config.id);
          }}
        />
      ))}
    </ul>
  );
}

/**
 * The commission structures a member is given, picked from the business's configs. With none yet, the empty state
 * offers a small form for a first one (when the caller may create configs). A caller who may not see the configs gets
 * a neutral notice, and the member's configs are kept as they are.
 */
export function CommissionPicker(props: CommissionPickerProps): ReactNode {
  const { configs, bases, selected, canSee, canCreate, onChange } = props;
  const { i18n } = useLingui();
  const noticeId = commissionNoticeIdOf({ canSee, configCount: configs.length });
  const notice = noticeId !== undefined && <p className="text-muted-foreground text-sm">{i18n._(noticeId)}</p>;
  if (!canSee) return notice;
  const chosen = configs.filter((config) => selected.includes(config.id));
  const options = configs.filter((config) => !selected.includes(config.id));
  return (
    <div className="grid gap-2">
      {chosen.length > 0 && (
        <ChosenList
          chosen={chosen}
          bases={bases}
          onRemove={(removed) => {
            onChange(selected.filter((id) => id !== removed));
          }}
        />
      )}
      {options.length > 0 && (
        <AddCommission
          options={options}
          onAdd={(id) => {
            onChange([...selected, id]);
          }}
        />
      )}
      {notice}
      {canCreate && (
        <CommissionCreator
          bases={bases}
          onCreated={(config) => {
            onChange([...selected, config.id]);
          }}
        />
      )}
    </div>
  );
}
