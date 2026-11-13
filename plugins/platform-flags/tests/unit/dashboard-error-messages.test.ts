import { FLAG_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { FLAGS_FORBIDDEN_MESSAGE_ID, FLAGS_GENERIC_ERROR_MESSAGE_ID } from '../../dashboard/constants';
import { DYNAMIC_MESSAGE_IDS } from '../../dashboard/i18n/dynamic-ids';
import { flagErrorMessageId } from '../../dashboard/error-messages';

const coded = (code: unknown): unknown => ({ extensions: { code } });

describe('flagErrorMessageId', () => {
  it.each(Object.values(FLAG_ERROR_CODES))('answers the server code %s with its own message id', (code) => {
    expect(flagErrorMessageId(coded(code))).toBe(code);
  });

  it('answers a refusal for lack of permission with the forbidden message', () => {
    expect(flagErrorMessageId(coded('FORBIDDEN'))).toBe(FLAGS_FORBIDDEN_MESSAGE_ID);
  });

  it.each([undefined, null, 'text', {}, coded('flags.not-a-code'), coded(42), new Error('network')])(
    'falls back to the generic message for %j',
    (error) => {
      expect(flagErrorMessageId(error)).toBe(FLAGS_GENERIC_ERROR_MESSAGE_ID);
    },
  );

  it('registers every server code as a dynamic message id for i18n:check', () => {
    expect(DYNAMIC_MESSAGE_IDS).toEqual(expect.arrayContaining(Object.values(FLAG_ERROR_CODES)));
  });
});
