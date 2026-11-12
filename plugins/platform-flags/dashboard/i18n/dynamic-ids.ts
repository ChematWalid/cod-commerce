import { FLAG_ERROR_CODES, FLAG_KEYS } from '@cod/shared';

/** The server's flag error codes, shown as messages of the same id (D89), and each seeded flag's description. */
export const DYNAMIC_MESSAGE_IDS: readonly string[] = [
  ...Object.values(FLAG_ERROR_CODES),
  ...Object.values(FLAG_KEYS).map((key) => `flags.description.${key}`),
];
