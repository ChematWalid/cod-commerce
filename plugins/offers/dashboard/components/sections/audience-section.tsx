import type { Audience } from '@cod/shared';
import type { ReactNode } from 'react';
import { ChoiceGroup } from '../choice-group';
import type { SectionProps } from './section-props';

const AUDIENCE_CHOICE_IDS: Readonly<Record<Audience, string>> = {
  everyone: 'offers.editor-audience-everyone',
  first: 'offers.editor-audience-first',
  returning: 'offers.editor-audience-returning',
};

/** Who gets the offer: everyone, a first order, or buyers who ordered before (D2418). */
export function AudienceSection({ form, disabled, onChange }: SectionProps): ReactNode {
  return (
    <ChoiceGroup
      legendId="offers.editor-audience"
      value={form.eligibility.audience}
      labelIds={AUDIENCE_CHOICE_IDS}
      disabled={disabled}
      onChange={(audience) => {
        onChange({ eligibility: { ...form.eligibility, audience } });
      }}
    />
  );
}
