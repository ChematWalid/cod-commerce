import { COLLECTION_RULE_MAX_TEXT_VALUES, COLLECTION_RULE_MAX_VALUES, COLLECTION_RULE_TEXT_MAX } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Button, Checkbox, Input } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import type { StoreCollectionRuleOptionsDto } from '../dto';
import { unknownValuesOf, type ValueChoice, valueChoicesOf } from '../model/condition-fields';
import { type ConditionInputProps, PriceRangeField } from './price-range-field';

const toggled = (values: readonly string[], id: string): readonly string[] =>
  values.includes(id) ? values.filter((value) => value !== id) : [...values, id];

/** A picked or typed value as a chip with its remove button; merchant text, isolated and never translated. */
function ValueChip(props: { readonly label: string; readonly disabled: boolean; readonly onRemove: () => void }) {
  const { i18n } = useLingui();
  return (
    <li className="bg-muted flex items-center gap-1 rounded-md ps-2">
      <bdi className="text-sm [overflow-wrap:anywhere]">{props.label}</bdi>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label={i18n._('collections.value-remove')}
        disabled={props.disabled}
        onClick={props.onRemove}
      >
        ×
      </Button>
    </li>
  );
}

/** Stored ids the store no longer offers (D2307): shown as unknown, removable. */
function UnknownValues(props: {
  readonly ids: readonly string[];
  readonly disabled: boolean;
  readonly onRemove: (id: string) => void;
}): ReactNode {
  const { i18n } = useLingui();
  return (
    <ul className="flex flex-wrap gap-1">
      {props.ids.map((id) => (
        <ValueChip
          key={id}
          label={i18n._('collections.value-unknown')}
          disabled={props.disabled}
          onRemove={() => {
            props.onRemove(id);
          }}
        />
      ))}
    </ul>
  );
}

/** Tags, brands or option values of the store, picked by checkbox; a stored id the store lost shows as unknown. */
function ChoiceValues(props: ConditionInputProps & { readonly choices: readonly ValueChoice[] }): ReactNode {
  const { i18n } = useLingui();
  const values = props.condition.values ?? [];
  const pick = (id: string): void => {
    const next = toggled(values, id);
    if (next.length <= COLLECTION_RULE_MAX_VALUES) props.onChange({ values: next });
  };
  if (props.choices.length === 0 && values.length === 0)
    return <p className="text-muted-foreground text-sm">{i18n._('collections.values-none')}</p>;
  return (
    <div className="grid gap-2">
      <UnknownValues ids={unknownValuesOf(values, props.choices)} disabled={props.disabled} onRemove={pick} />
      <ul className="grid max-h-48 gap-1 overflow-y-auto">
        {props.choices.map((choice) => (
          <li key={choice.id}>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={values.includes(choice.id)}
                disabled={props.disabled}
                onCheckedChange={() => {
                  pick(choice.id);
                }}
              />
              <bdi className="[overflow-wrap:anywhere]">{choice.name}</bdi>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The input a title word is typed in, added by Enter or the Add button. */
function TextValueInput(props: { readonly disabled: boolean; readonly onAdd: (text: string) => boolean }): ReactNode {
  const { i18n } = useLingui();
  const [typed, setTyped] = useState('');
  const add = (): void => {
    if (props.onAdd(typed.trim())) setTyped('');
  };
  return (
    <div className="flex gap-2">
      <Input
        aria-label={i18n._('collections.title-value')}
        placeholder={i18n._('collections.title-value')}
        maxLength={COLLECTION_RULE_TEXT_MAX}
        disabled={props.disabled}
        value={typed}
        onChange={(event) => {
          setTyped(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          add();
        }}
      />
      <Button type="button" variant="outline" disabled={props.disabled} onClick={add}>
        {i18n._('collections.title-value-add')}
      </Button>
    </div>
  );
}

/** Title words: typed one at a time, each kept as a chip (D2303). */
function TextValues(props: ConditionInputProps): ReactNode {
  const values = props.condition.values ?? [];
  const add = (text: string): boolean => {
    if (text === '' || values.includes(text) || values.length >= COLLECTION_RULE_MAX_TEXT_VALUES) return false;
    props.onChange({ values: [...values, text] });
    return true;
  };
  return (
    <div className="grid gap-2">
      <ul className="flex flex-wrap gap-1">
        {values.map((value) => (
          <ValueChip
            key={value}
            label={value}
            disabled={props.disabled}
            onRemove={() => {
              props.onChange({ values: values.filter((kept) => kept !== value) });
            }}
          />
        ))}
      </ul>
      <TextValueInput disabled={props.disabled} onAdd={add} />
    </div>
  );
}

/** "On sale is": yes or no. */
function OnSaleValue({ condition, disabled, onChange }: ConditionInputProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <div role="group" className="flex gap-2">
      {[true, false].map((value) => (
        <Button
          key={String(value)}
          type="button"
          size="sm"
          variant={condition.value === value ? 'default' : 'outline'}
          aria-pressed={condition.value === value}
          disabled={disabled}
          onClick={() => {
            onChange({ value });
          }}
        >
          {i18n._(value ? 'collections.on-sale-yes' : 'collections.on-sale-no')}
        </Button>
      ))}
    </div>
  );
}

/** The value part of a condition row, by field: a range, yes/no, typed words or the store's values. */
export function ValuesField(
  props: ConditionInputProps & { readonly options: StoreCollectionRuleOptionsDto | undefined },
): ReactNode {
  if (props.condition.field === 'price') return <PriceRangeField {...props} />;
  if (props.condition.field === 'on_sale') return <OnSaleValue {...props} />;
  const choices = props.options === undefined ? [] : valueChoicesOf(props.condition, props.options);
  return choices === null ? <TextValues {...props} /> : <ChoiceValues {...props} choices={choices} />;
}
