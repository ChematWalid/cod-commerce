import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, toast } from '@vendure/dashboard';
import { PRODUCTS_QUERY_KEY } from '../constants';
import { listErrorMessageId } from '../model/list-view';
import { sendForStore } from '../model/store-bound-fetch';
import { readRequestToken, type StoreScope } from '../queries';

const STOP_MUTATION = `mutation CatalogStopSoldOutOrders($input: CatalogSoldOutOrdersInput!) {
  stopCatalogSoldOutOrders(input: $input) { productId } }`;
const RESUME_MUTATION = `mutation CatalogResumeSoldOutOrders($input: CatalogSoldOutOrdersInput!) {
  resumeCatalogSoldOutOrders(input: $input) { productId } }`;

/** "Stop orders" and "Resume orders" of every sold-out product of the store, and the message each shows when done. */
const ORDER_COMMANDS = {
  stop: { document: STOP_MUTATION, doneId: 'catalog.orders-stopped-done' },
  resume: { document: RESUME_MUTATION, doneId: 'catalog.orders-resumed-done' },
} as const;

export type SoldOutOrdersCommand = keyof typeof ORDER_COMMANDS;

/**
 * Runs Stop or Resume orders on every sold-out product of `scope`'s store (an empty list, D2108), sent only while
 * requests go to that store, then refreshes the list; a refusal shows its translated message.
 */
export function useSoldOutOrders(scope: StoreScope | null) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: SoldOutOrdersCommand) =>
      sendForStore(scope?.channelToken ?? null, readRequestToken, () =>
        api.mutate(ORDER_COMMANDS[command].document, { input: { productIds: [] } }),
      ),
    onSuccess: async (_answer, command) => {
      toast.success(i18n._(ORDER_COMMANDS[command].doneId));
      await queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      toast.error(i18n._(listErrorMessageId(error)));
    },
  });
}
