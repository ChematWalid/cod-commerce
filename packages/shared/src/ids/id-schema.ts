import { z } from 'zod';
import { vendureIdStringSchema } from '../collections/fields';
import { isSnowflake, type Snowflake } from './snowflake';

/** Decimal digits of a positive bigint without a leading zero: at most 19 digits (ADR 0003). */
const ID_FORMAT = /^[1-9][0-9]{0,18}$/;

/**
 * An id of one of our entities at an API boundary: a decimal string from 1 to 2^63 − 1, kept as a string so no digit
 * is lost past 2^53 (ADR 0003). A number is refused, however small: it may already have lost digits.
 */
export const idSchema: z.ZodType<Snowflake> = z
  .string()
  .regex(ID_FORMAT)
  .refine((value): value is Snowflake => isSnowflake(value));

/**
 * A Vendure core id (product, variant, collection, asset, channel): a canonical decimal string within the int column
 * range. The same schema as `vendureIdStringSchema`, under the name the id contracts use.
 */
export const coreIdSchema = vendureIdStringSchema;
