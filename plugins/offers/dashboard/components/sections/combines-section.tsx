import type { CombinationClass } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { CheckRow } from '../check-row';
import type { SectionProps } from './section-props';

const COMBINATION_LABEL_IDS: Readonly<Record<CombinationClass, string>> = {
  order: 'offers.editor-combines-order',
  product: 'offers.editor-combines-product',
  delivery: 'offers.editor-combines-delivery',
};

const CLASSES = Object.keys(COMBINATION_LABEL_IDS) as CombinationClass[];

/** Which other classes of offer this one combines with (D2411); none by default. */
export function CombinesSection({ form, disabled, onChange }: SectionProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{i18n._('offers.editor-combines')}</legend>
      {CLASSES.map((combination) => (
        <CheckRow
          key={combination}
          label={i18n._(COMBINATION_LABEL_IDS[combination])}
          checked={form.combinesWith[combination]}
          disabled={disabled}
          onToggle={(on) => {
            onChange({ combinesWith: { ...form.combinesWith, [combination]: on } });
          }}
        />
      ))}
    </fieldset>
  );
}
