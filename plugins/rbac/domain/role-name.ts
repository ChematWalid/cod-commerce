import { ROLE_NAME_MAX_LENGTH } from '@cod/shared';
import { RoleNameInvalidError } from './errors';

/** A role name as kept, and the key that decides whether two names are the same (D71). */
export interface ParsedRoleName {
  readonly name: string;
  readonly nameKey: string;
}

const RUN_OF_SPACES = /\s+/g;

/** JavaScript has no casefold; going through upper case first also folds `ß` to `ss`. */
const caseFolded = (text: string): string => text.toUpperCase().toLowerCase();

/**
 * Normalises a role name (NFKC, trimmed, runs of spaces collapsed) and derives its uniqueness key.
 *
 * @throws {RoleNameInvalidError} when the result is empty or longer than {@link ROLE_NAME_MAX_LENGTH} characters.
 */
export function parseRoleName(raw: string): ParsedRoleName {
  const name = raw.normalize('NFKC').replace(RUN_OF_SPACES, ' ').trim();
  const characters = Array.from(name).length;
  if (characters === 0 || characters > ROLE_NAME_MAX_LENGTH) {
    throw new RoleNameInvalidError();
  }
  return { name, nameKey: caseFolded(name) };
}
