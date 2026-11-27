import { PRICING_ERROR_CODES } from '@cod/shared';
import type { z } from 'zod';
import { QUOTE_REQUEST_INVALID_CODE } from '../domain/constants';
import { QuoteRequestInvalidError } from '../domain/quote-errors';

const SHARED_CODES: ReadonlySet<string> = new Set<string>(Object.values(PRICING_ERROR_CODES));

/** The stable code of a refusal: the shared pricing code its first issue carries, else the storefront's own. */
function codeOf(error: z.ZodError): string {
  const message = error.issues[0]?.message;
  return message !== undefined && SHARED_CODES.has(message) ? message : QUOTE_REQUEST_INVALID_CODE;
}

/**
 * `raw` parsed by the shared quote contract `schema`: unknown keys (`waive`, `storeId`, `channel`) are stripped by the
 * schema, never read. Throws a {@link QuoteRequestInvalidError} carrying only a stable code.
 */
export function parsedQuoteBody<Schema extends z.ZodType>(schema: Schema, raw: unknown): z.output<Schema> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new QuoteRequestInvalidError(codeOf(parsed.error));
  return parsed.data;
}
