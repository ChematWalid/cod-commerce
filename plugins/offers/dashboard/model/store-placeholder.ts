/** The part of a cached query the placeholder rule reads: its key, which names the store it answers for. */
export interface KeyedQuery {
  readonly queryKey: readonly unknown[];
}

/**
 * The placeholder a store query shows while its new key loads. The dashboard keeps the previous answer on screen for
 * every key change (`keepPreviousData`); that is right for a tab, search or page change of one store, but after a store
 * switch it would show the previous store's rows and permissions under the new one, so only an answer of the same
 * store is kept. `storeIndex` is where the store id sits in the key.
 */
export function placeholderWithinStore(storeIndex: number, storeId: string | null) {
  return <T>(previous: T | undefined, previousQuery: KeyedQuery | undefined): T | undefined => {
    if (storeId === null) return undefined;
    return previousQuery?.queryKey[storeIndex] === storeId ? previous : undefined;
  };
}
