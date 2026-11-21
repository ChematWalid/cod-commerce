import { IMPORT_FIELD_KEYS, IMPORT_FORMATS, type ImportFieldKey, type ImportFormat } from '@cod/shared';
import { JOB_POLL_INTERVAL_MS } from '../constants';

/** The wizard's steps, in order (D2210): a file, its columns, the rows it would write, then the write itself. */
export const WIZARD_STEPS = ['upload', 'mapping', 'preview', 'confirm'] as const;
/** One of the {@link WIZARD_STEPS}. */
export type WizardStep = (typeof WIZARD_STEPS)[number];

/** Where the wizard is, which import job it drives, and whether the merchant confirmed it. */
export interface WizardState {
  readonly step: WizardStep;
  readonly importId: string | null;
  readonly confirmed: boolean;
}

/** The preview's counts (`CatalogImportSummary`). */
export interface ImportSummary {
  readonly creates: number;
  readonly updates: number;
  readonly errors: number;
  readonly warnings: number;
}

/** A column of the analyzed file (`CatalogImportColumn`). */
export interface ImportColumn {
  readonly column: number;
  readonly header: string;
  readonly field: string | null;
  readonly warning: string | null;
}

/** The field one column fills, or `null` to ignore it (`CatalogImportColumnMappingInput`). */
export interface ColumnMapping {
  readonly column: number;
  readonly field: ImportFieldKey | null;
}

/** Statuses of an import or export job after which nothing changes (D2210, D2211). */
const SETTLED_JOB_STATUSES: ReadonlySet<string> = new Set(['done', 'failed']);

/** A wizard with no file yet. */
export const initialWizard = (): WizardState => ({ step: 'upload', importId: null, confirmed: false });

/** The file of `importId` is uploaded and analyzed: its columns are next. */
export const withAnalyzed = (state: WizardState, importId: string): WizardState => ({
  ...state,
  step: 'mapping',
  importId,
});

/** The mapping is sent and the rows are planned: the preview is next. */
export const withPreviewed = (state: WizardState): WizardState => ({ ...state, step: 'preview' });

/** The merchant read the preview: the confirmation is next. */
export const withReviewed = (state: WizardState): WizardState => ({ ...state, step: 'confirm' });

/** The import is confirmed: it runs, and the wizard cannot go back any more. */
export const withConfirmed = (state: WizardState): WizardState => ({ ...state, confirmed: true });

/**
 * The state one step back, or `null` when there is none: on the first step, and once confirmed (the rows are being
 * written). Back from the columns starts over with another file.
 */
export function previousStep(state: WizardState): WizardState | null {
  if (state.confirmed) return null;
  const index = WIZARD_STEPS.indexOf(state.step);
  if (index <= 0) return null;
  const step = WIZARD_STEPS[index - 1] ?? 'upload';
  return step === 'upload' ? initialWizard() : { ...state, step };
}

/** Whether the import may be confirmed: some row would be created or updated (rows in error are never written). */
export const confirmAllowed = (summary: ImportSummary | null | undefined): boolean =>
  summary !== null && summary !== undefined && summary.creates + summary.updates > 0;

/** How long until a job is read again: never once it is done or failed (TanStack's `refetchInterval`). */
export const jobPollInterval = (status: string | undefined): number | false =>
  status !== undefined && SETTLED_JOB_STATUSES.has(status) ? false : JOB_POLL_INTERVAL_MS;

/** Whether a job status is final. */
export const jobSettled = (status: string | undefined): boolean => jobPollInterval(status) === false;

/** Narrows a field key the server answered to one of the spreadsheet's keys (D2209). */
export const importFieldKeyOf = (field: string | null): ImportFieldKey | null =>
  IMPORT_FIELD_KEYS.find((key) => key === field) ?? null;

/** The mapping the server guessed for each column, as the mapping step starts from. */
export const mappingOf = (columns: readonly ImportColumn[]): readonly ColumnMapping[] =>
  columns.map(({ column, field }) => ({ column, field: importFieldKeyOf(field) }));

/** The mapping with `column` filling `field` instead (or ignored when `null`). */
export const withColumnField = (
  mapping: readonly ColumnMapping[],
  column: number,
  field: ImportFieldKey | null,
): readonly ColumnMapping[] => mapping.map((entry) => (entry.column === column ? { column, field } : entry));

/** The spreadsheet format of a file by its extension, or `null` for any other file. */
export function uploadFormatOf(fileName: string): ImportFormat | null {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return null;
  const extension = fileName.slice(dot + 1).toLowerCase();
  return IMPORT_FORMATS.find((format) => format === extension) ?? null;
}
