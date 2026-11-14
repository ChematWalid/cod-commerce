import { describe, expect, it } from 'vitest';
import {
  errorCodeOf,
  LOGO_UPLOAD_FAILED_MESSAGE_ID,
  logoErrorMessageId,
  SETTINGS_SAVE_FAILED_MESSAGE_ID,
  settingsErrorMessageId,
} from '../dashboard/model/api-error';

const coded = (code: unknown): unknown => ({ extensions: { code } });

describe('errorCodeOf', () => {
  it('reads the stable code of an API error', () => {
    expect(errorCodeOf(coded('tenancy.name-invalid'))).toBe('tenancy.name-invalid');
  });

  it.each([undefined, null, 'text', {}, { extensions: null }, coded(42)])('has none for %j', (error) => {
    expect(errorCodeOf(error)).toBeUndefined();
  });
});

describe('settingsErrorMessageId', () => {
  it('is the server code itself when the catalogue has a sentence for it', () => {
    expect(settingsErrorMessageId(coded('tenancy.name-invalid'))).toBe('tenancy.name-invalid');
    expect(settingsErrorMessageId(coded('tenancy.store-archived'))).toBe('tenancy.store-archived');
  });

  it('falls back for a refusal without a sentence', () => {
    expect(settingsErrorMessageId(coded('FORBIDDEN'))).toBe(SETTINGS_SAVE_FAILED_MESSAGE_ID);
    expect(settingsErrorMessageId(new Error('network'))).toBe(SETTINGS_SAVE_FAILED_MESSAGE_ID);
  });
});

describe('logoErrorMessageId', () => {
  it('explains a too large or non-image file, and falls back for anything else', () => {
    expect(logoErrorMessageId(coded('auth.logo-too-large'))).toBe('shell.settings.logo-too-large');
    expect(logoErrorMessageId(coded('auth.logo-type'))).toBe('shell.settings.logo-type');
    expect(logoErrorMessageId(coded('auth.image-type'))).toBe('shell.settings.logo-type');
    expect(logoErrorMessageId(coded('FORBIDDEN'))).toBe(LOGO_UPLOAD_FAILED_MESSAGE_ID);
  });
});
