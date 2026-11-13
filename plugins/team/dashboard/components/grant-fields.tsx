import { STORE_ACCESS_KINDS, type StoreAccessKind } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Input, Label, RadioGroup, RadioGroupItem } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';
import type { CommissionBasisDto, CommissionConfigDto, RoleOptionDto, StoreOptionDto } from '../dto';
import type { InviteErrors, MemberGrantDraft } from '../invite-form-validation';
import { roleLabelOf, useUiLanguage } from '../labels';
import { ChoiceList } from './choice-list';
import { CommissionPicker } from './commission-picker';

/** What the grant fields choose from. */
export interface GrantOptions {
  readonly roles: readonly RoleOptionDto[];
  readonly stores: readonly StoreOptionDto[];
  readonly commissions: readonly CommissionConfigDto[];
  readonly bases: readonly CommissionBasisDto[];
  /** Whether the caller holds `team.commissions.view`; without it the configs were not asked for. */
  readonly canSeeCommissions: boolean;
  readonly canCreateCommission: boolean;
}

interface GrantFieldsProps {
  readonly draft: MemberGrantDraft;
  /** Only the errors to show: none until the person has changed something. */
  readonly errors: InviteErrors;
  readonly options: GrantOptions;
  readonly onChange: (patch: Partial<MemberGrantDraft>) => void;
}

const STORE_ACCESS_LABEL_IDS: Readonly<Record<StoreAccessKind, string>> = {
  all: 'team.store-access-all',
  selected: 'team.store-access-selected',
};

/** A field's caption and, under it, its message when it is invalid. */
export function FieldFrame(props: {
  readonly label: string;
  readonly htmlFor?: string;
  readonly errorId: string | undefined;
  readonly children: ReactNode;
}): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.htmlFor}>{props.label}</Label>
      {props.children}
      {props.errorId !== undefined && <p className="text-destructive text-xs">{i18n._(props.errorId)}</p>}
    </div>
  );
}

function StoreAccessChoice({ draft, errors, options, onChange }: GrantFieldsProps): ReactNode {
  const { i18n } = useLingui();
  const label = i18n._('team.field-store-access');
  return (
    <FieldFrame label={label} errorId={errors.storeIds}>
      <RadioGroup
        className="flex flex-wrap gap-4"
        aria-label={label}
        value={draft.storeAccess}
        onValueChange={(next) => {
          onChange({ storeAccess: next as StoreAccessKind });
        }}
      >
        {STORE_ACCESS_KINDS.map((kind) => (
          <label key={kind} className="flex items-center gap-2 text-sm">
            <RadioGroupItem value={kind} />
            {i18n._(STORE_ACCESS_LABEL_IDS[kind])}
          </label>
        ))}
      </RadioGroup>
      {draft.storeAccess === 'selected' && (
        <ChoiceList
          label={i18n._('team.field-stores')}
          choices={options.stores.map((store) => ({ id: store.id, label: store.name }))}
          selected={draft.storeIds}
          invalid={errors.storeIds !== undefined}
          onChange={(storeIds) => {
            onChange({ storeIds });
          }}
        />
      )}
    </FieldFrame>
  );
}

function SalaryField({ draft, errors, onChange }: GrantFieldsProps): ReactNode {
  const { i18n } = useLingui();
  const id = useId();
  return (
    <FieldFrame label={i18n._('team.field-salary')} htmlFor={id} errorId={errors.baseSalary}>
      <Input
        id={id}
        inputMode="numeric"
        dir="ltr"
        value={draft.baseSalary}
        aria-invalid={errors.baseSalary !== undefined}
        onChange={(event) => {
          onChange({ baseSalary: event.target.value });
        }}
      />
    </FieldFrame>
  );
}

/** Roles, store access, base salary and commission structures: the grant the invite and edit dialogs share. */
export function GrantFields(props: GrantFieldsProps): ReactNode {
  const { i18n } = useLingui();
  const language = useUiLanguage();
  const { draft, errors, options, onChange } = props;
  const roleChoices = options.roles.map((role) => ({ id: role.id, label: roleLabelOf(role, language) }));
  return (
    <>
      <FieldFrame label={i18n._('team.field-roles')} errorId={errors.roleIds}>
        <ChoiceList
          label={i18n._('team.field-roles')}
          choices={roleChoices}
          selected={draft.roleIds}
          invalid={errors.roleIds !== undefined}
          onChange={(roleIds) => {
            onChange({ roleIds });
          }}
        />
      </FieldFrame>
      <StoreAccessChoice {...props} />
      <SalaryField {...props} />
      <FieldFrame label={i18n._('team.field-commissions')} errorId={undefined}>
        <CommissionPicker
          configs={options.commissions}
          bases={options.bases}
          selected={draft.commissionConfigIds}
          canSee={options.canSeeCommissions}
          canCreate={options.canCreateCommission}
          onChange={(commissionConfigIds) => {
            onChange({ commissionConfigIds });
          }}
        />
      </FieldFrame>
    </>
  );
}
