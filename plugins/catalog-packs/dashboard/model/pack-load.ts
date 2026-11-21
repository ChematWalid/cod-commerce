/** What the block reads of one of its queries (TanStack's result, narrowed to what decides the view). */
export interface BlockAnswer<T> {
  readonly data: T | undefined;
  readonly isError: boolean;
  /** `storeQuery` shows the previous key's answer of the same store while a new key loads. */
  readonly isPlaceholderData: boolean;
}

/** What the block shows for one query. */
export type BlockLoad<T> =
  { readonly kind: 'loading' } | { readonly kind: 'error' } | { readonly kind: 'ready'; readonly data: T };

/**
 * Decides the block's view of a query. A placeholder counts as loading (as catalog's `editorLoadViewOf`): the editor
 * copies its props into state once, so opening it on another key's answer would freeze that answer (wrong titles, or
 * another product's pack under this product's Save). A failed refetch keeps the answer it had.
 */
export function blockLoadOf<T>(answer: BlockAnswer<T>): BlockLoad<T> {
  if (answer.data !== undefined && !answer.isPlaceholderData) return { kind: 'ready', data: answer.data };
  return answer.isError ? { kind: 'error' } : { kind: 'loading' };
}
