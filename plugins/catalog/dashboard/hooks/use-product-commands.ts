import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@vendure/dashboard';
import { PRODUCTS_QUERY_KEY } from '../constants';
import { listErrorMessageId } from '../model/list-view';
import { deleteProduct, setProductStatus } from '../queries';

/** A list command the server runs: its call and the message shown when it succeeded. */
const COMMANDS = {
  'set-draft': { run: (id: string) => setProductStatus(id, 'draft'), doneId: 'catalog.set-draft-done' },
  delete: { run: deleteProduct, doneId: 'catalog.delete-done' },
} as const;

export type ProductCommand = keyof typeof COMMANDS;

/** Runs a row command, then refreshes the list; a refusal is shown as its translated message. */
export function useProductCommand(onSettled: () => void) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ command, productId }: { readonly command: ProductCommand; readonly productId: string }) =>
      COMMANDS[command].run(productId),
    onSuccess: async (_answer, { command }) => {
      toast.success(i18n._(COMMANDS[command].doneId));
      await queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      toast.error(i18n._(listErrorMessageId(error)));
    },
    onSettled,
  });
}
