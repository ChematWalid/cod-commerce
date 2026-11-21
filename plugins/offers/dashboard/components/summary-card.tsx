import type { OfferPreview } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { SUMMARY_CARD_TEST_ID } from '../constants';
import type { OfferEditorForm } from '../model/editor-form';
import { formatWhole } from '../model/list-view';
import { type SummaryLine, summaryOf } from '../model/summary';

export interface SummaryCardProps {
  readonly form: OfferEditorForm;
  readonly preview?: OfferPreview | undefined;
}

/** A line's values as the merchant reads them: numbers grouped in the dashboard's language, text as typed. */
function valuesOf(line: SummaryLine, language: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(line.values ?? {}).map(([name, value]) => [
      name,
      typeof value === 'number' ? formatWhole(value, language) : value,
    ]),
  );
}

/**
 * The live summary of the offer (D2523): one sentence per group of the form, from catalogue templates. The sample
 * amounts are the server's preview, never computed here (ADR 0017).
 */
export function SummaryCard({ form, preview }: SummaryCardProps): ReactNode {
  const { i18n } = useLingui();
  const lines = summaryOf(form, preview);
  return (
    <ul className="grid list-disc gap-1 ps-5 text-sm" data-testid={SUMMARY_CARD_TEST_ID}>
      {lines.map((line, index) => (
        <li key={`${line.id}-${String(index)}`}>{i18n._(line.id, valuesOf(line, i18n.locale))}</li>
      ))}
    </ul>
  );
}
