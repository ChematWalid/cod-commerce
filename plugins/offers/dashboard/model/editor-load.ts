import { listErrorMessageId } from './list-view';

// A copy of the catalog dashboard's editor load rule (a plugin never imports another's internals, §3a.2).

/** What the editor reads of its offer query (TanStack's result, narrowed to what decides the view). */
export interface EditorAnswer<T> {
  /** The offer, `null` when the store has none by that id, `undefined` before a first answer. */
  readonly data: T | null | undefined;
  readonly isError: boolean;
  readonly error: unknown;
  readonly isPlaceholderData: boolean;
}

/** What the editor page shows for its offer query. */
export type EditorLoadView<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly messageId: string }
  | { readonly kind: 'not-found' }
  /** `refetchErrorId`: a later refetch failed; the editor stays open, with its edits, above a notice. */
  | { readonly kind: 'editor'; readonly offer: T; readonly refetchErrorId: string | undefined };

/**
 * Decides the editor page. A failed refetch keeps the answer it had (TanStack keeps `data`), so once the offer is
 * loaded an error never unmounts the editor: that would drop the merchant's unsaved edits.
 */
export function editorLoadViewOf<T>(answer: EditorAnswer<T>): EditorLoadView<T> {
  if (answer.data === undefined || answer.isPlaceholderData) {
    return answer.isError ? { kind: 'error', messageId: listErrorMessageId(answer.error) } : { kind: 'loading' };
  }
  if (answer.data === null) return { kind: 'not-found' };
  const refetchErrorId = answer.isError ? listErrorMessageId(answer.error) : undefined;
  return { kind: 'editor', offer: answer.data, refetchErrorId };
}
