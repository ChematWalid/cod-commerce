import { COMMISSION_BASES, COMMISSION_VALUE_KINDS, type CommissionBasis, type CommissionValueKind } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vendure/dashboard';
import { type ReactNode, useId, useState } from 'react';
import { commissionInputOf, type CommissionDraft, emptyCommissionDraft } from '../commission-draft';
import { CANCEL_MESSAGE_ID, COMMISSIONS_QUERY_KEY } from '../constants';
import type { CommissionBasisDto, CommissionConfigDto } from '../dto';
import { basisLabelOf, useUiLanguage } from '../labels';
import { createCommissionConfig } from '../queries';
import { ErrorAlert } from './form-footer';

const KIND_LABEL_IDS: Readonly<Record<CommissionValueKind, string>> = {
  fixed: 'team.commission-kind-fixed',
  percent: 'team.commission-kind-percent',
};

interface PickProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly T[];
  readonly labelOf: (option: T) => string;
  readonly onChange: (value: T) => void;
}

function PickField<T extends string>({ label, value, options, labelOf, onChange }: PickProps<T>): ReactNode {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{labelOf(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labelOf(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TextInput(props: { readonly label: string; readonly value: string; readonly onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{props.label}</Label>
      <Input
        id={id}
        value={props.value}
        dir="auto"
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
    </div>
  );
}

interface CommissionInlineFormProps {
  readonly bases: readonly CommissionBasisDto[];
  readonly onCreated: (config: CommissionConfigDto) => void;
  readonly onCancel: () => void;
}

/** Sends a draft the form already found complete; the server checks it again. */
async function createFromDraft(draft: CommissionDraft): Promise<CommissionConfigDto> {
  const input = commissionInputOf(draft);
  if (input === null) throw new Error('An incomplete commission draft was submitted');
  return createCommissionConfig(input);
}

function useCreateCommission(onCreated: (config: CommissionConfigDto) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFromDraft,
    onSuccess: async (config: CommissionConfigDto) => {
      await queryClient.invalidateQueries({ queryKey: COMMISSIONS_QUERY_KEY });
      onCreated(config);
    },
  });
}

interface DraftFieldsProps {
  readonly draft: CommissionDraft;
  readonly bases: readonly CommissionBasisDto[];
  readonly onChange: (change: Partial<CommissionDraft>) => void;
}

function DraftFields({ draft, bases, onChange }: DraftFieldsProps): ReactNode {
  const { i18n } = useLingui();
  const language = useUiLanguage();
  return (
    <>
      <TextInput
        label={i18n._('team.commission-name')}
        value={draft.name}
        onChange={(name) => {
          onChange({ name });
        }}
      />
      <PickField<CommissionBasis>
        label={i18n._('team.commission-basis')}
        value={draft.basis}
        options={COMMISSION_BASES}
        labelOf={(basis) => basisLabelOf(basis, bases, language)}
        onChange={(basis) => {
          onChange({ basis });
        }}
      />
      <PickField<CommissionValueKind>
        label={i18n._('team.commission-kind')}
        value={draft.valueKind}
        options={COMMISSION_VALUE_KINDS}
        labelOf={(kind) => i18n._(KIND_LABEL_IDS[kind])}
        onChange={(valueKind) => {
          onChange({ valueKind });
        }}
      />
      <TextInput
        label={i18n._('team.commission-value')}
        value={draft.value}
        onChange={(value) => {
          onChange({ value });
        }}
      />
    </>
  );
}

/** A small form for a first commission structure, kept inside the invite dialog: every store, stored only. */
export function CommissionInlineForm(props: CommissionInlineFormProps): ReactNode {
  const { i18n } = useLingui();
  const [draft, setDraft] = useState<CommissionDraft>(emptyCommissionDraft);
  const create = useCreateCommission(props.onCreated);
  return (
    <div className="grid gap-3 rounded-md border p-3" data-testid="team-commission-inline-form">
      <DraftFields
        draft={draft}
        bases={props.bases}
        onChange={(change) => {
          setDraft({ ...draft, ...change });
        }}
      />
      <ErrorAlert error={create.error} />
      <span className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={props.onCancel}>
          {i18n._(CANCEL_MESSAGE_ID)}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={commissionInputOf(draft) === null || create.isPending}
          onClick={() => {
            create.mutate(draft);
          }}
        >
          {i18n._('team.commission-create')}
        </Button>
      </span>
    </div>
  );
}
