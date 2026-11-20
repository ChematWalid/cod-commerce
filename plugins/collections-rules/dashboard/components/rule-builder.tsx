import { COLLECTION_RULE_MAX_CONDITIONS, RULE_MATCHES, type RuleMatch } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { ADD_CONDITION_TEST_ID, COLLECTION_MATCH_ALL_TEST_ID, COLLECTION_MATCH_ANY_TEST_ID } from '../constants';
import { conditionFieldsOf } from '../model/condition-fields';
import { errorMessageIdOf } from '../model/list-view';
import {
  emptyRule,
  type RuleDraft,
  withAddedCondition,
  withConditionChange,
  withFieldChoice,
  withMatch,
  withoutCondition,
} from '../model/rule-draft';
import { rowKeysFor, withoutRowKey } from '../model/row-keys';
import { useRuleOptions } from '../rule-queries';
import type { ScopedCardProps } from './card-props';
import { ConditionRow } from './condition-row';
import { PreviewPanel } from './preview-panel';

const MATCH_TEST_IDS: Readonly<Record<RuleMatch, string>> = {
  all: COLLECTION_MATCH_ALL_TEST_ID,
  any: COLLECTION_MATCH_ANY_TEST_ID,
};
const MATCH_LABEL_IDS: Readonly<Record<RuleMatch, string>> = {
  all: 'collections.match-all',
  any: 'collections.match-any',
};

/** All or Any (D2303). */
function MatchSwitch(props: {
  readonly rule: RuleDraft;
  readonly disabled: boolean;
  readonly onChange: (rule: RuleDraft) => void;
}) {
  const { i18n } = useLingui();
  return (
    <div role="group" aria-label={i18n._('collections.match-label')} className="flex flex-wrap items-center gap-2">
      <span className="text-sm">{i18n._('collections.match-label')}</span>
      {RULE_MATCHES.map((match) => (
        <Button
          key={match}
          type="button"
          size="sm"
          data-testid={MATCH_TEST_IDS[match]}
          variant={props.rule.match === match ? 'default' : 'outline'}
          aria-pressed={props.rule.match === match}
          disabled={props.disabled}
          onClick={() => {
            props.onChange(withMatch(props.rule, match));
          }}
        >
          {i18n._(MATCH_LABEL_IDS[match])}
        </Button>
      ))}
    </div>
  );
}

interface RuleRowsProps {
  readonly rule: RuleDraft;
  readonly fields: ReturnType<typeof conditionFieldsOf>;
  readonly options: ReturnType<typeof useRuleOptions>['data'];
  readonly disabled: boolean;
  readonly onChange: (rule: RuleDraft) => void;
}

const mintRowKey = (): string => crypto.randomUUID();

/**
 * The rows' keys, kept across renders: a row keeps its key when one before it is removed, so the word typed in its
 * title input stays with it (see `row-keys`).
 */
function useRowKeys(count: number): { readonly keys: readonly string[]; readonly remove: (index: number) => void } {
  const [stored, setStored] = useState<readonly string[]>([]);
  const keys = rowKeysFor(stored, count, mintRowKey);
  // Adjusting state while rendering (React's documented pattern): the minted keys are kept for the next render.
  if (keys !== stored) setStored(keys);
  return {
    keys,
    remove: (index) => {
      setStored(withoutRowKey(keys, index));
    },
  };
}

/** The rows of the rule, each changing only itself. */
function ConditionList({ rule, fields, options, disabled, onChange }: RuleRowsProps): ReactNode {
  const rowKeys = useRowKeys(rule.conditions.length);
  return (
    <ul className="grid gap-3">
      {rule.conditions.map((condition, index) => (
        <ConditionRow
          key={rowKeys.keys[index]}
          condition={condition}
          fields={fields}
          options={options}
          disabled={disabled}
          onField={(choice) => {
            onChange(withFieldChoice(rule, index, choice));
          }}
          onChange={(conditionChange) => {
            onChange(withConditionChange(rule, index, conditionChange));
          }}
          onRemove={() => {
            rowKeys.remove(index);
            onChange(withoutCondition(rule, index));
          }}
        />
      ))}
    </ul>
  );
}

/** Adds a row on the first field (Tag), up to the cap of D2322. */
function AddCondition({ rule, fields, disabled, onChange }: RuleRowsProps): ReactNode {
  const { i18n } = useLingui();
  const [firstField] = fields;
  const full = rule.conditions.length >= COLLECTION_RULE_MAX_CONDITIONS;
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        data-testid={ADD_CONDITION_TEST_ID}
        disabled={disabled || firstField === undefined || full}
        onClick={() => {
          if (firstField !== undefined) onChange(withAddedCondition(rule, firstField));
        }}
      >
        {i18n._('collections.condition-add')}
      </Button>
    </div>
  );
}

/** The conditions of an automatic collection and the live preview of what they match. */
export function RuleBuilder(props: ScopedCardProps): ReactNode {
  const { i18n } = useLingui();
  const options = useRuleOptions(props.scope);
  const rows: RuleRowsProps = {
    rule: props.form.rule ?? emptyRule(),
    fields: conditionFieldsOf(options.data),
    options: options.data,
    disabled: props.disabled,
    onChange: (rule) => {
      props.onChange({ rule });
    },
  };
  return (
    <div className="grid gap-4">
      <MatchSwitch rule={rows.rule} disabled={props.disabled} onChange={rows.onChange} />
      {options.isError && <p role="alert">{i18n._(errorMessageIdOf(options.error))}</p>}
      <ConditionList {...rows} />
      <AddCondition {...rows} />
      <PreviewPanel scope={props.scope} rule={props.form.rule} />
    </div>
  );
}
