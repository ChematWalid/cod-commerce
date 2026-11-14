import type { ColumnOptions } from 'typeorm';

/**
 * A column holding a Vendure core id (product, asset): Postgres `integer`, read back as the decimal string the catalog
 * carries (`CoreId`). Writes pass the string through; Postgres casts it.
 */
export const CORE_ID_COLUMN: ColumnOptions = {
  type: 'integer',
  transformer: {
    to: (value: unknown): unknown => value,
    from: (value: number | null): string | null => (value === null ? null : String(value)),
  },
};
