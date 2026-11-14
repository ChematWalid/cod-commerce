import { AUTH_ERROR_CODES } from '@cod/shared';

/** The API's stable code of a failed call, when it gave one. */
export function errorCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('extensions' in error)) return undefined;
  const { extensions } = error;
  if (typeof extensions !== 'object' || extensions === null || !('code' in extensions)) return undefined;
  return typeof extensions.code === 'string' ? extensions.code : undefined;
}

/** The catalogue id of each code `updateBusiness` and `updateStore` answer with. The id is the code itself. */
const SETTINGS_ERROR_CODES: ReadonlySet<string> = new Set([
  'tenancy.name-invalid',
  'tenancy.unsupported-store-language',
  'tenancy.store-not-found',
  'tenancy.store-archived',
  'tenancy.business-not-found',
  'tenancy.asset-not-available',
]);

/** Used for a refusal the catalogue has no sentence for, such as `FORBIDDEN`. */
export const SETTINGS_SAVE_FAILED_MESSAGE_ID = 'shell.settings.save-failed';

/** The catalogue id that explains a failed settings save: the server's code when we have words for it. */
export function settingsErrorMessageId(error: unknown): string {
  const code = errorCodeOf(error);
  return code !== undefined && SETTINGS_ERROR_CODES.has(code) ? code : SETTINGS_SAVE_FAILED_MESSAGE_ID;
}

/** The catalogue id of each code `uploadBusinessLogo` refuses a file with. */
const LOGO_ERROR_MESSAGE_IDS: Readonly<Record<string, string>> = {
  [AUTH_ERROR_CODES.LOGO_TOO_LARGE]: 'shell.settings.logo-too-large',
  [AUTH_ERROR_CODES.LOGO_TYPE]: 'shell.settings.logo-type',
  [AUTH_ERROR_CODES.IMAGE_TYPE]: 'shell.settings.logo-type',
};

/** Used for a refused upload the catalogue has no sentence for. */
export const LOGO_UPLOAD_FAILED_MESSAGE_ID = 'shell.settings.logo-failed';

/** The catalogue id that explains a refused logo upload. */
export function logoErrorMessageId(error: unknown): string {
  const code = errorCodeOf(error);
  return (code === undefined ? undefined : LOGO_ERROR_MESSAGE_IDS[code]) ?? LOGO_UPLOAD_FAILED_MESSAGE_ID;
}
