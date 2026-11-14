import { listErrorMessageId } from './list-view';

/** What the editor reads of its product query (TanStack's result, narrowed to what decides the view). */
export interface EditorAnswer<T> {
  /** The product, `null` when the store has none by that id, `undefined` before a first answer. */
  readonly data: T | null | undefined;
  readonly isError: boolean;
  readonly error: unknown;
  readonly isPlaceholderData: boolean;
}

/** What the editor page shows for its product query. */
export type EditorLoadView<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly messageId: string }
  | { readonly kind: 'not-found' }
  /** `refetchErrorId`: a later refetch failed; the editor stays open, with its edits, above a notice. */
  | { readonly kind: 'editor'; readonly product: T; readonly refetchErrorId: string | undefined };

/**
 * Decides the editor page. A failed refetch keeps the answer it had (TanStack keeps `data`), so once the product is
 * loaded an error never unmounts the editor: that would drop the merchant's unsaved edits.
 */
export function editorLoadViewOf<T>(answer: EditorAnswer<T>): EditorLoadView<T> {
  if (answer.data === undefined || answer.isPlaceholderData) {
    return answer.isError ? { kind: 'error', messageId: listErrorMessageId(answer.error) } : { kind: 'loading' };
  }
  if (answer.data === null) return { kind: 'not-found' };
  const refetchErrorId = answer.isError ? listErrorMessageId(answer.error) : undefined;
  return { kind: 'editor', product: answer.data, refetchErrorId };
}
