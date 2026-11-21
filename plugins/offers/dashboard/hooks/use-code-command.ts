import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@vendure/dashboard';
import { OFFER_CODES_QUERY_KEY } from '../constants';
import { listErrorMessageId } from '../model/list-view';

/**
 * Runs one change of an offer's codes, then refreshes the code list; a refusal (a taken code, a full offer, another
 * store) is shown as its translated message.
 */
export function useCodeCommand<Input>(send: (input: Input) => Promise<unknown>, doneMessageId: string) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: async () => {
      toast.success(i18n._(doneMessageId));
      await queryClient.invalidateQueries({ queryKey: OFFER_CODES_QUERY_KEY });
    },
    onError: (error: unknown) => {
      toast.error(i18n._(listErrorMessageId(error)));
    },
  });
}
