import { useLingui } from '@lingui/react';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { CONDITION_ROW_TEST_ID } from '../constants';
import type { StoreCollectionConditionDto, StoreCollectionRuleOptionsDto } from '../dto';
import {
  type ConditionFieldChoice,
  fieldChoiceOf,
  fieldLabelIdOf,
  operatorLabelIdOf,
  operatorsOf,
} from '../model/condition-fields';
import { ValuesField } from './values-field';

export interface ConditionRowProps {
  readonly condition: StoreCollectionConditionDto;
  readonly fields: readonly ConditionFieldChoice[];
  readonly options: StoreCollectionRuleOptionsDto | undefined;
  readonly disabled: boolean;
  readonly onField: (choice: ConditionFieldChoice) => void;
  readonly onChange: (change: Partial<StoreCollectionConditionDto>) => void;
  readonly onRemove: () => void;
}

/** A field's name: ours translated, an option name as the merchant typed it (isolated, never translated). */
function FieldName({ choice }: { readonly choice: ConditionFieldChoice }): ReactNode {
  const { i18n } = useLingui();
  return choice.option === null ? i18n._(fieldLabelIdOf(choice.field)) : <bdi>{choice.option}</bdi>;
}

/** The field select: the store's fields, plus the row's own one if the store no longer offers it. */
function FieldSelect(props: ConditionRowProps): ReactNode {
  const { i18n } = useLingui();
  const current = fieldChoiceOf(props.condition);
  const offered = props.fields.some(({ key }) => key === current.key) ? props.fields : [...props.fields, current];
  return (
    <Select
      value={current.key}
      disabled={props.disabled}
      onValueChange={(key) => {
        const choice = offered.find((field) => field.key === key);
        if (choice !== undefined && choice.key !== current.key) props.onField(choice);
      }}
    >
      <SelectTrigger className="w-full sm:w-44" aria-label={i18n._('collections.condition-field')}>
        <SelectValue>
          <FieldName choice={current} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {offered.map((choice) => (
          <SelectItem key={choice.key} value={choice.key}>
            <FieldName choice={choice} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function OperatorSelect({ condition, disabled, onChange }: ConditionRowProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <Select
      value={condition.operator}
      disabled={disabled}
      onValueChange={(operator) => {
        if (operator !== null) onChange({ operator });
      }}
    >
      <SelectTrigger className="w-full sm:w-40" aria-label={i18n._('collections.condition-operator')}>
        <SelectValue>{i18n._(operatorLabelIdOf(condition.operator))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {operatorsOf(condition.field).map((operator) => (
          <SelectItem key={operator} value={operator}>
            {i18n._(operatorLabelIdOf(operator))}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** One condition: field, operator, then its values; removable. */
export function ConditionRow(props: ConditionRowProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <li
      data-testid={CONDITION_ROW_TEST_ID}
      data-field={props.condition.field}
      className="grid gap-3 rounded-md border p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <FieldSelect {...props} />
        <OperatorSelect {...props} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ms-auto"
          disabled={props.disabled}
          onClick={props.onRemove}
        >
          {i18n._('collections.condition-remove')}
        </Button>
      </div>
      <ValuesField
        condition={props.condition}
        options={props.options}
        disabled={props.disabled}
        onChange={props.onChange}
      />
    </li>
  );
}
