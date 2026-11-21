import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, toast } from '@vendure/dashboard';
import { OFFERS_QUERY_KEY } from '../constants';
import { listErrorMessageId } from '../model/list-view';
import { type OfferCommand, rowCommandDoneId, sendRowCommand } from '../model/row-commands';
import { readRequestToken, type StoreScope } from '../queries';

export type { OfferCommand } from '../model/row-commands';

/**
 * Runs a row command on `scope`'s store, sent only while requests go to that store, then refreshes the list; a
 * refusal, a switched store included, is shown as its translated message.
 */
export function useOfferCommand(scope: StoreScope | null, onSettled: () => void) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ command, offerId }: { readonly command: OfferCommand; readonly offerId: string }) =>
      sendRowCommand(
        { store: scope, readToken: readRequestToken, mutate: (document, variables) => api.mutate(document, variables) },
        command,
        offerId,
      ),
    onSuccess: async (_answer, { command }) => {
      toast.success(i18n._(rowCommandDoneId(command)));
      await queryClient.invalidateQueries({ queryKey: OFFERS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      toast.error(i18n._(listErrorMessageId(error)));
    },
    onSettled,
  });
}
