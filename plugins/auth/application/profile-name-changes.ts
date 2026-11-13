import { updateAccountProfileSchema } from '@cod/shared';
import { ProfileInvalidError } from '../domain/errors';

/** The names a profile save may change; an absent name is kept. */
export interface NameChanges {
  readonly firstName?: string;
  readonly lastName?: string;
}

/** The profile form's own name rules, each name optional: every account email greets the owner by name. */
const nameChangesSchema = updateAccountProfileSchema.pick({ firstName: true, lastName: true }).partial();

/**
 * Trims the names a save gives and leaves out the ones it leaves out.
 *
 * @throws ProfileInvalidError naming each given name that is blank or too long.
 */
export function parseNameChanges(changes: NameChanges): NameChanges {
  const parsed = nameChangesSchema.safeParse(changes);
  if (!parsed.success) {
    throw new ProfileInvalidError([...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]);
  }
  const { firstName, lastName } = parsed.data;
  return {
    ...(firstName === undefined ? {} : { firstName }),
    ...(lastName === undefined ? {} : { lastName }),
  };
}
