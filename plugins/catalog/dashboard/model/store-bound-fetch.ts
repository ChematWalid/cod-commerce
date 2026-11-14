/**
 * Raised when the store a query answers for is not the store its request went to. A store switch writes the new
 * channel token and refetches every mounted query at once, while the list is still keyed by the old store, so the
 * answer would be cached under the wrong store.
 */
export class StoreSwitchedError extends Error {
  constructor() {
    super('The active store changed while the query was answering for another store');
    this.name = 'StoreSwitchedError';
  }
}

/** Whether `error` is a dropped answer of a switched store rather than an API error. */
export const isStoreSwitched = (error: unknown): error is StoreSwitchedError => error instanceof StoreSwitchedError;

/**
 * Raised when the browser holds no channel token to compare (its storage is blocked or empty). Unlike a switch, no
 * store change will settle it, so it is shown as an error at once instead of waiting.
 */
export class StoreTokenMissingError extends Error {
  constructor() {
    super('The selected channel token could not be read from the browser storage');
    this.name = 'StoreTokenMissingError';
  }
}

export const isStoreTokenMissing = (error: unknown): error is StoreTokenMissingError =>
  error instanceof StoreTokenMissingError;

/** How often a dropped answer of a switched store is fetched again before the error shows. */
const STORE_SWITCH_RETRIES = 1;

/**
 * The `retry` of a store query: a dropped answer is fetched again once, since a switch in this tab settles in that
 * time (and the page is then mounted for the new store); a switch that persists, such as one made in another tab,
 * then shows its error instead of loading for ever. An API error is not retried.
 */
export const retriesStoreSwitch = (failureCount: number, error: unknown): boolean =>
  isStoreSwitched(error) && failureCount < STORE_SWITCH_RETRIES;

/** The stored token, or {@link StoreTokenMissingError} when there is none to compare. */
function storedToken(readToken: () => string | null): string {
  const token = readToken();
  if (token === null) throw new StoreTokenMissingError();
  return token;
}

/**
 * Runs `fetchAnswer` only while requests carry `expectedToken`, the channel token of the store the query is keyed by,
 * and keeps the answer only if they still do when it arrives; otherwise throws {@link StoreSwitchedError}, so the
 * other store's rows and permissions are never cached under this store.
 */
export async function fetchForStore<T>(
  expectedToken: string,
  readToken: () => string | null,
  fetchAnswer: () => Promise<T>,
): Promise<T> {
  if (storedToken(readToken) !== expectedToken) throw new StoreSwitchedError();
  const answer = await fetchAnswer();
  if (storedToken(readToken) !== expectedToken) throw new StoreSwitchedError();
  return answer;
}

/**
 * Sends a write only while requests carry `expectedToken`, the channel token of the store the page is open for, so a
 * store switched in another tab (the token is shared) never makes a create or an upload land in that other store.
 * A `null` expected token (store not known yet) refuses too, and a missing stored one is {@link StoreTokenMissingError}.
 * Unlike a read, the answer is kept after a later switch: the write
 * already happened in the expected store.
 */
export async function sendForStore<T>(
  expectedToken: string | null,
  readToken: () => string | null,
  send: () => Promise<T>,
): Promise<T> {
  if (expectedToken === null || storedToken(readToken) !== expectedToken) throw new StoreSwitchedError();
  return send();
}
