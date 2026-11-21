import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { type ReactNode, useState } from 'react';
import { wholeNumberOf } from '../model/kind-editors';

export interface NumberFieldProps {
  readonly label: string;
  /** The stored value; `null` is a blank field (no cap, no limit). */
  readonly value: number | null;
  /** Called with each typed whole number, or `null` when the field is cleared; other text is kept but not sent. */
  readonly onValue: (next: number | null) => void;
  readonly disabled: boolean;
  readonly suffix?: string;
  readonly hint?: string;
}

const textOf = (value: number | null): string => (value === null ? '' : String(value));

/**
 * A whole-number field of a kind's card. What is typed stays shown while the field has focus, so clearing a
 * required field to type a new value does not snap it back; on blur it shows the stored value again.
 */
export function NumberField(props: NumberFieldProps): ReactNode {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <TextField
      label={props.label}
      inputMode="numeric"
      dir="ltr"
      value={draft ?? textOf(props.value)}
      disabled={props.disabled}
      {...(props.suffix === undefined ? {} : { suffix: props.suffix })}
      {...(props.hint === undefined ? {} : { hint: props.hint })}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const next = wholeNumberOf(text);
        if (next !== undefined) props.onValue(next);
      }}
      onBlur={() => {
        setDraft(null);
      }}
    />
  );
}
