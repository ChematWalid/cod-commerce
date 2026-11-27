import { z } from 'zod';
import { WILAYA_CODES } from '../wilayas/wilayas';
import { deliveryPriceSchema } from './schema-parts';

/**
 * The most bytes a pricing-option CSV import reads, 256 KiB (D3142): far above a full option (one row per wilaya and per
 * commune is about 60 KB), small enough for the synchronous flow. The row cap is derived from the data instead.
 */
export const PRICING_CSV_MAX_BYTES = 262_144;

/** The columns of a pricing-option CSV, in the order the export writes them (D3142); the import reads them by name. */
export const PRICING_CSV_COLUMNS = [
  'level',
  'provinceCode',
  'codeOns',
  'homePrice',
  'deskPrice',
  'deliveryEnabled',
  'deskEnabled',
] as const;

/** One column of a pricing-option CSV. */
export type PricingCsvColumn = (typeof PRICING_CSV_COLUMNS)[number];

/** What a CSV row prices: a wilaya row, or a commune row of a wilaya (empty cells inherit). */
export const PRICING_CSV_LEVELS = ['wilaya', 'commune'] as const;

/** A level of a pricing-option CSV row. */
export type PricingCsvLevel = (typeof PRICING_CSV_LEVELS)[number];

/** How a switch cell reads: the export writes these; the import also takes them in any letter case. */
export const PRICING_CSV_SWITCH_ON = 'true';
export const PRICING_CSV_SWITCH_OFF = 'false';

/**
 * Why a CSV row is refused (D3142); a row issue names its row and column, never the cell's value. `unexpected-commune`
 * is a commune code on a wilaya row, `missing-value` an empty cell a wilaya row needs.
 */
export const PRICING_CSV_ROW_ISSUES = [
  'invalid-level',
  'unknown-wilaya',
  'unknown-commune',
  'commune-not-in-wilaya',
  'unexpected-commune',
  'duplicate-key',
  'invalid-price',
  'invalid-switch',
  'missing-value',
] as const;

/** One reason a CSV row is refused. */
export type PricingCsvRowIssue = (typeof PRICING_CSV_ROW_ISSUES)[number];

/** The most row issues an import answers; `totalIssues` still counts them all. */
export const PRICING_CSV_MAX_REPORTED_ISSUES = 100;

/** A row's effective prices and switches (override ?? base); `null` on a commune row inherits the wilaya's. */
export const deliveryFeeCsvValuesSchema = z.object({
  homePrice: deliveryPriceSchema.nullable(),
  deskPrice: deliveryPriceSchema.nullable(),
  deliveryEnabled: z.boolean().nullable(),
  deskEnabled: z.boolean().nullable(),
});

/** A row's effective prices and switches. */
export type DeliveryFeeCsvValues = z.output<typeof deliveryFeeCsvValuesSchema>;

/**
 * One row an import changes: its key, what it holds now (`null`: a commune with no row yet) and what it would hold
 * (`null`: a commune row left empty, which goes).
 */
export const deliveryFeeCsvChangeSchema = z.object({
  level: z.enum(PRICING_CSV_LEVELS),
  provinceCode: z.enum(WILAYA_CODES),
  codeOns: z.number().int().nullable(),
  before: deliveryFeeCsvValuesSchema.nullable(),
  after: deliveryFeeCsvValuesSchema.nullable(),
});

/** One row an import changes. */
export type DeliveryFeeCsvChange = z.output<typeof deliveryFeeCsvChangeSchema>;

/** One refused row: its 1-based record number (the header is 1), the column when one is to blame, and why. */
export const deliveryFeeCsvIssueSchema = z.object({
  row: z.number().int().min(1),
  column: z.enum(PRICING_CSV_COLUMNS).nullable(),
  issue: z.enum(PRICING_CSV_ROW_ISSUES),
});

/** One refused row of an import. */
export type DeliveryFeeCsvIssue = z.output<typeof deliveryFeeCsvIssueSchema>;
