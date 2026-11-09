import { ACCOUNT_USER_ID_MAX } from './constants';

/**
 * The one conversion of a Vendure user id to the number `account_token.userId` stores. The project keeps Vendure's
 * default auto-increment id strategy, so a user id is a Postgres `int`.
 *
 * @throws RangeError for anything else, rather than storing a rounded or foreign id.
 */
export function accountUserId(id: string | number): number {
  const value = Number(id);
  if (!Number.isInteger(value) || value < 1 || value > ACCOUNT_USER_ID_MAX) {
    throw new RangeError('A user id is outside the range account tokens can hold');
  }
  return value;
}
