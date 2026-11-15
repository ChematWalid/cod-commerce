import {
  CODE_MAX_LENGTH,
  CODE_MIN_LENGTH,
  CODE_PATTERN,
  INT_COLUMN_MAX,
  invalidOfferConfig,
  MAX_CODE_INPUT_LENGTH,
  MAX_CODES_PER_ADD,
} from '@cod/shared';
import { z } from 'zod';
import { normaliseCode } from './engine/codes';
import { CodeTakenError, InvalidOfferConfigError } from './errors';

/** A code a merchant adds: typed loosely, stored trimmed and upper-cased, 3 to 32 of `[A-Z0-9_-]` (D2406). */
const codeInputSchema = z.object(
  {
    code: z
      .string(invalidOfferConfig)
      .max(MAX_CODE_INPUT_LENGTH, invalidOfferConfig)
      .transform(normaliseCode)
      .pipe(
        z
          .string(invalidOfferConfig)
          .min(CODE_MIN_LENGTH, invalidOfferConfig)
          .max(CODE_MAX_LENGTH, invalidOfferConfig)
          .regex(CODE_PATTERN, invalidOfferConfig),
      ),
    usageLimit: z
      .number(invalidOfferConfig)
      .int(invalidOfferConfig)
      .min(1, invalidOfferConfig)
      .max(INT_COLUMN_MAX, invalidOfferConfig)
      .nullable()
      .default(null),
  },
  invalidOfferConfig,
);

export type CodeInput = z.input<typeof codeInputSchema>;
export type CodeCommand = z.output<typeof codeInputSchema>;

/**
 * The codes of one add, normalised.
 *
 * @throws {@link InvalidOfferConfigError} for a malformed code or limit, or more than `MAX_CODES_PER_ADD` codes.
 * @throws {@link CodeTakenError} when two inputs normalise to the same code.
 */
export function parseCodes(inputs: readonly CodeInput[]): readonly CodeCommand[] {
  const parsed = z.array(codeInputSchema).max(MAX_CODES_PER_ADD, invalidOfferConfig).safeParse(inputs);
  if (!parsed.success) throw new InvalidOfferConfigError();
  const texts = new Set(parsed.data.map((entry) => entry.code));
  if (texts.size < parsed.data.length) throw new CodeTakenError();
  return parsed.data;
}
