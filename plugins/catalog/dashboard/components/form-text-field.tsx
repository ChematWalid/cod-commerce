import { TextField } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import type { ComponentProps, ReactNode } from 'react';
import type { EditorForm } from '../model/editor-form';
import type { SectionProps } from './section-props';

/** The fields of the form that hold typed text. */
export type TextFieldKey = {
  [K in keyof EditorForm]: EditorForm[K] extends string ? (K extends 'status' ? never : K) : never;
}[keyof EditorForm];

type InputProps = Omit<ComponentProps<typeof TextField>, 'label' | 'value' | 'onChange' | 'errorId' | 'hint'>;

interface FormTextFieldProps extends InputProps {
  readonly section: SectionProps;
  readonly field: TextFieldKey;
  readonly labelId: string;
  readonly hintId?: string;
}

/** One text field of the editor bound to its form key, its refusal and the card's read-only state. */
export function FormTextField({ section, field, labelId, hintId, ...input }: FormTextFieldProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <TextField
      {...input}
      label={i18n._(labelId)}
      {...(hintId === undefined ? {} : { hint: i18n._(hintId) })}
      value={section.form[field]}
      disabled={section.disabled}
      errorId={section.errors[field]}
      onChange={(event) => {
        section.onChange({ [field]: event.target.value });
      }}
    />
  );
}
