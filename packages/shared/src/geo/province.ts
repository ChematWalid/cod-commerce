import { z } from 'zod';
import { WILAYA_CODES } from '../wilayas/wilayas';

/** A place name as the geo seed stores it: never blank. */
const placeNameSchema = z.string().min(1);

/**
 * A commune (town) of the geo reference data (data-model.md, `GET /provinces/code/:code`). `codeOns` is the ONS
 * commune code and the stable commune key (D3104); `id` is `String(codeOns)`, and so is the `townOns` of an offers
 * quote destination.
 */
export const townSchema = z.object({
  id: z.string(),
  provinceCode: z.enum(WILAYA_CODES),
  name: placeNameSchema,
  arabicName: placeNameSchema,
  /** Other spellings, for "type to find" matching. */
  names: z.array(placeNameSchema),
  codeOns: z.number().int().positive(),
  isStopdesk: z.boolean(),
  isHomeDelivery: z.boolean(),
});

/** A commune of the geo reference data. */
export type Town = z.output<typeof townSchema>;

/**
 * A wilaya (province) of the geo reference data. `id` is its two-digit `code`. The list answers provinces without
 * `towns`; the detail by code answers them with their towns.
 */
export const provinceSchema = z.object({
  id: z.string(),
  code: z.enum(WILAYA_CODES),
  name: placeNameSchema,
  arabicName: placeNameSchema,
  /** Other spellings, for "type to find" matching. */
  names: z.array(placeNameSchema),
  towns: z.array(townSchema).optional(),
});

/** A wilaya of the geo reference data. */
export type Province = z.output<typeof provinceSchema>;
