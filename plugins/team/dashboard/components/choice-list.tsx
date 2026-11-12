import { Checkbox } from '@vendure/dashboard';
import type { ReactNode } from 'react';

/** One option of a multiple choice. */
export interface Choice {
  readonly id: string;
  readonly label: string;
}

interface ChoiceListProps {
  readonly label: string;
  readonly choices: readonly Choice[];
  readonly selected: readonly string[];
  readonly invalid: boolean;
  readonly onChange: (selected: readonly string[]) => void;
}

const toggled = (selected: readonly string[], id: string, on: boolean): readonly string[] =>
  on ? [...selected.filter((candidate) => candidate !== id), id] : selected.filter((candidate) => candidate !== id);

/** A bordered list of check boxes, scrolled when long: roles or stores to grant. */
export function ChoiceList({ label, choices, selected, invalid, onChange }: ChoiceListProps): ReactNode {
  return (
    <div
      role="group"
      aria-label={label}
      aria-invalid={invalid}
      className="cod-team-choice-list grid gap-2 rounded-md border p-2"
    >
      {choices.map((choice) => (
        <label key={choice.id} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={selected.includes(choice.id)}
            onCheckedChange={(on) => {
              onChange(toggled(selected, choice.id, on));
            }}
          />
          <span className="[overflow-wrap:anywhere]">{choice.label}</span>
        </label>
      ))}
    </div>
  );
}
