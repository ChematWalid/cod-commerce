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
 * Runs `fetchAnswer` only while requests carry `expectedToken`, the channel token of the store the query is keyed by,
 * and keeps the answer only if they still do when it arrives; otherwise throws {@link StoreSwitchedError}, so the
 * other store's rows and permissions are never cached under this store.
 */
export async function fetchForStore<T>(
  expectedToken: string,
  readToken: () => string | null,
  fetchAnswer: () => Promise<T>,
): Promise<T> {
  if (readToken() !== expectedToken) throw new StoreSwitchedError();
  const answer = await fetchAnswer();
  if (readToken() !== expectedToken) throw new StoreSwitchedError();
  return answer;
}
