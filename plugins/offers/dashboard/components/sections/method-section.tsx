import type { OfferMethod } from '@cod/shared';
import type { ReactNode } from 'react';
import { ChoiceGroup } from '../choice-group';
import type { SectionProps } from './section-props';

const METHOD_CHOICE_IDS: Readonly<Record<OfferMethod, string>> = {
  automatic: 'offers.editor-method-automatic',
  codes: 'offers.editor-method-codes',
};

/** Applied by itself, or by a code the buyer types (D2403). */
export function MethodSection({ form, disabled, onChange }: SectionProps): ReactNode {
  return (
    <ChoiceGroup
      legendId="offers.editor-method"
      value={form.method}
      labelIds={METHOD_CHOICE_IDS}
      disabled={disabled}
      onChange={(method) => {
        onChange({ method });
      }}
    />
  );
}
