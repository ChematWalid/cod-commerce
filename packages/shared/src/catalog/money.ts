import { z } from 'zod';
import { INT_COLUMN_MAX } from './constants';
import { CATALOG_ERROR_CODES } from './error-codes';

/** Highest price, in whole DZD: the Postgres `int` column Vendure stores prices in (ADR 0004). */
export const MONEY_MAX_DZD = INT_COLUMN_MAX;

/** A price in whole DZD (ADR 0004): an integer from 0 to {@link MONEY_MAX_DZD}. */
export const moneySchema = z
  .number({ message: CATALOG_ERROR_CODES.INVALID_INPUT })
  .int({ message: CATALOG_ERROR_CODES.INVALID_INPUT })
  .min(0, { message: CATALOG_ERROR_CODES.INVALID_INPUT })
  .max(MONEY_MAX_DZD, { message: CATALOG_ERROR_CODES.INVALID_INPUT });
