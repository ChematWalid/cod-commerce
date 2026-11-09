import { NAME_MAX_LENGTH } from './constants';
import { NameInvalidError } from './errors';

/**
 * Checks a business or store name.
 *
 * @throws {@link NameInvalidError} when it is blank or longer than the column
 */
export function assertValidName(name: string): void {
  if (name.trim().length === 0 || name.length > NAME_MAX_LENGTH) {
    throw new NameInvalidError();
  }
}
