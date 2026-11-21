import { IMPORT_HEADER_WINDOW_ROWS } from '@cod/shared';
import { hasRequiredFields, mapColumns } from './column-mapper';

/** Where the header row is among the first rows of a file, or that none of them is one. */
export type HeaderVerdict = { readonly kind: 'found'; readonly rowIndex: number } | { readonly kind: 'no-header' };

/**
 * The header row (D2209, D2224): the first of the first {@link IMPORT_HEADER_WINDOW_ROWS} rows whose cells name both
 * required columns (a name and a price), so title rows above the table are skipped.
 */
export function detectHeader(rows: readonly (readonly string[])[]): HeaderVerdict {
  const window = rows.slice(0, IMPORT_HEADER_WINDOW_ROWS);
  const rowIndex = window.findIndex((cells) => hasRequiredFields(mapColumns(cells)));
  return rowIndex === -1 ? { kind: 'no-header' } : { kind: 'found', rowIndex };
}
