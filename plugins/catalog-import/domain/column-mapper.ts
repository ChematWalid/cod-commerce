import {
  CATALOG_IMPORT_ROW_WARNINGS,
  type CatalogImportRowWarning,
  IMPORT_FIELDS,
  type ImportFieldKey,
  normalizeImportHeader,
} from '@cod/shared';

/** One column of the file: its position, its header text and the field it fills (`null`: ignored). */
export interface MappedColumn {
  readonly column: number;
  readonly header: string;
  readonly field: ImportFieldKey | null;
}

/** A column the import ignores and why. */
export interface ColumnWarning {
  readonly column: number;
  readonly reason: CatalogImportRowWarning;
}

/** How the file's columns fill the import's fields (D2209): every header column, in order, and its warnings. */
export interface ColumnMap {
  readonly assignments: readonly MappedColumn[];
  readonly warnings: readonly ColumnWarning[];
}

/** A merchant's choice for one column (D2210): the field it fills, or `null` to ignore it. */
export interface ColumnOverride {
  readonly column: number;
  readonly field: ImportFieldKey | null;
}

/** The column read but ignored until P2.S3 (D2209). */
const IGNORED_FIELD: ImportFieldKey = 'collections';
const REQUIRED_FIELDS: readonly ImportFieldKey[] = IMPORT_FIELDS.filter((field) => field.required).map(
  (field) => field.key,
);

/** Every alias in every language, and each key itself, normalised → its field (D2224). */
const FIELD_OF_ALIAS: ReadonlyMap<string, ImportFieldKey> = new Map(
  IMPORT_FIELDS.flatMap((field) =>
    [field.key, ...field.aliases.ar, ...field.aliases.en, ...field.aliases.fr].map(
      (alias) => [normalizeImportHeader(alias), field.key] as const,
    ),
  ),
);

/** The field a header names, compared after {@link normalizeImportHeader}, or undefined. */
export function fieldOfHeader(header: string): ImportFieldKey | undefined {
  return FIELD_OF_ALIAS.get(normalizeImportHeader(header));
}

/** The detected field of each column: the first column naming a field takes it. */
function detectedFields(header: readonly string[]): (ImportFieldKey | undefined)[] {
  const taken = new Set<ImportFieldKey>();
  return header.map((text) => {
    const field = fieldOfHeader(text);
    if (field === undefined || taken.has(field)) return undefined;
    taken.add(field);
    return field;
  });
}

/** The fields after the merchant's overrides: an overridden field leaves the column that held it. */
function withOverrides(
  fields: readonly (ImportFieldKey | undefined)[],
  overrides: readonly ColumnOverride[],
): (ImportFieldKey | null | undefined)[] {
  const result: (ImportFieldKey | null | undefined)[] = [...fields];
  for (const { column, field } of overrides) {
    if (column >= result.length) continue;
    if (field !== null) {
      const holder = result.indexOf(field);
      if (holder !== -1 && holder !== column) result[holder] = null;
    }
    result[column] = field;
  }
  return result;
}

/** The warning of a column the import ignores, or undefined: an empty or deliberately unmapped column has none. */
function warningOf(header: string, field: ImportFieldKey | null | undefined): CatalogImportRowWarning | undefined {
  if (field === IGNORED_FIELD) return CATALOG_IMPORT_ROW_WARNINGS.COLLECTIONS_IGNORED;
  if (field === undefined && header.trim() !== '') return CATALOG_IMPORT_ROW_WARNINGS.UNKNOWN_COLUMN;
  return undefined;
}

/**
 * Maps a header row onto the import's fields (D2209, D2224): ar/en/fr aliases, a second column of the same field and
 * any unknown header ignored with `warn-unknown-column`, the `collections` column ignored with
 * `warn-collections-ignored` until P2.S3. `overrides` (the merchant's mapping, D2210) win over detection; a column the
 * merchant unmaps carries no warning.
 */
export function mapColumns(header: readonly string[], overrides: readonly ColumnOverride[] = []): ColumnMap {
  const fields = withOverrides(detectedFields(header), overrides);
  const assignments: MappedColumn[] = [];
  const warnings: ColumnWarning[] = [];
  header.forEach((text, column) => {
    const field = fields[column];
    const reason = warningOf(text, field);
    if (reason !== undefined) warnings.push({ column, reason });
    assignments.push({ column, header: text, field: field === undefined || field === IGNORED_FIELD ? null : field });
  });
  return { assignments, warnings };
}

/** Whether the mapping fills every required field: a name and a price (D2224). */
export function hasRequiredFields(map: ColumnMap): boolean {
  const mapped = new Set(map.assignments.map((assignment) => assignment.field));
  return REQUIRED_FIELDS.every((field) => mapped.has(field));
}
