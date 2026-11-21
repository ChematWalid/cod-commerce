import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { IMPORT_SUMMARY_TEST_ID } from '../constants';
import { WIZARD_STEPS, type WizardStep } from '../model/wizard';
import type { ImportSummary } from '../model/wizard';

const STEP_LABEL_IDS = {
  upload: 'catalog-import.step-upload',
  mapping: 'catalog-import.step-mapping',
  preview: 'catalog-import.step-preview',
  confirm: 'catalog-import.step-confirm',
} as const satisfies Record<WizardStep, string>;

/** The wizard's four steps, the current one marked. */
export function ImportSteps({ step }: { readonly step: WizardStep }): ReactNode {
  const { i18n } = useLingui();
  const current = WIZARD_STEPS.indexOf(step);
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {WIZARD_STEPS.map((each, index) => (
        <li
          key={each}
          aria-current={each === step ? 'step' : undefined}
          className={
            index === current
              ? 'bg-primary text-primary-foreground rounded-md px-3 py-1'
              : 'bg-muted text-muted-foreground rounded-md px-3 py-1'
          }
        >
          {i18n._('catalog-import.step-number', { number: index + 1, label: i18n._(STEP_LABEL_IDS[each]) })}
        </li>
      ))}
    </ol>
  );
}

const SUMMARY_LABEL_IDS = {
  creates: 'catalog-import.summary-creates',
  updates: 'catalog-import.summary-updates',
  errors: 'catalog-import.summary-errors',
  warnings: 'catalog-import.summary-warnings',
} as const satisfies Record<keyof ImportSummary, string>;

const SUMMARY_KEYS = ['creates', 'updates', 'errors', 'warnings'] as const;

/** The preview's counts: rows created, updated, in error, and with warnings. */
export function ImportSummaryView({ summary }: { readonly summary: ImportSummary | null }): ReactNode {
  const { i18n } = useLingui();
  if (summary === null) return null;
  return (
    <dl data-testid={IMPORT_SUMMARY_TEST_ID} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SUMMARY_KEYS.map((key) => (
        <div key={key} className="rounded-md border p-3">
          <dt className="text-muted-foreground text-xs">{i18n._(SUMMARY_LABEL_IDS[key])}</dt>
          <dd className="text-lg font-semibold">{summary[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
