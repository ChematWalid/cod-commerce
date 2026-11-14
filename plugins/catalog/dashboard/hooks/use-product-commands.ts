import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, toast } from '@vendure/dashboard';
import { PRODUCTS_QUERY_KEY } from '../constants';
import { listErrorMessageId } from '../model/list-view';
import { type ProductCommand, rowCommandDoneId, sendRowCommand } from '../model/row-commands';
import { readRequestToken, type StoreScope } from '../queries';

export type { ProductCommand } from '../model/row-commands';

/**
 * Runs a row command on `scope`'s store, sent only while requests go to that store, then refreshes the list; a
 * refusal, a switched store included, is shown as its translated message.
 */
export function useProductCommand(scope: StoreScope | null, onSettled: () => void) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ command, productId }: { readonly command: ProductCommand; readonly productId: string }) =>
      sendRowCommand(
        { store: scope, readToken: readRequestToken, mutate: (document, variables) => api.mutate(document, variables) },
        command,
        productId,
      ),
    onSuccess: async (_answer, { command }) => {
      toast.success(i18n._(rowCommandDoneId(command)));
      await queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      toast.error(i18n._(listErrorMessageId(error)));
    },
    onSettled,
  });
}
