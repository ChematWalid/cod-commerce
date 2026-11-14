import { Checkbox, Label } from '@vendure/dashboard';
import { type ReactNode, useId } from 'react';

/** One entry of a multiple choice. */
export interface CheckItem {
  readonly id: string;
  readonly label: string;
}

interface CheckListProps {
  readonly items: readonly CheckItem[];
  readonly selected: readonly string[];
  readonly disabled: boolean;
  /** Whether another entry may still be ticked (a cap such as six highlights). */
  readonly canAddMore?: boolean;
  readonly onChange: (selected: readonly string[]) => void;
}

const toggled = (selected: readonly string[], id: string, on: boolean): readonly string[] =>
  on ? [...selected, id] : selected.filter((existing) => existing !== id);

function CheckRow(
  props: { readonly item: CheckItem; readonly checked: boolean; readonly disabled: boolean } & {
    readonly onToggle: (on: boolean) => void;
  },
): ReactNode {
  const id = useId();
  return (
    <li className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={props.checked}
        disabled={props.disabled}
        onCheckedChange={(on) => {
          props.onToggle(on);
        }}
      />
      <Label htmlFor={id} className="font-normal [overflow-wrap:anywhere]">
        {props.item.label}
      </Label>
    </li>
  );
}

/** Ticks entries of a store list (tags, highlights, order managers), keeping the ids in the order ticked. */
export function CheckList({ items, selected, disabled, canAddMore = true, onChange }: CheckListProps): ReactNode {
  return (
    <ul className="grid gap-2">
      {items.map((item) => {
        const checked = selected.includes(item.id);
        return (
          <CheckRow
            key={item.id}
            item={item}
            checked={checked}
            disabled={disabled || (!checked && !canAddMore)}
            onToggle={(on) => {
              onChange(toggled(selected, item.id, on));
            }}
          />
        );
      })}
    </ul>
  );
}
