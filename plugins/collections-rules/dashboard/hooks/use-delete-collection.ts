import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@vendure/dashboard';
import { deleteStoreCollection } from '../commands';
import { COLLECTIONS_QUERY_KEY } from '../constants';
import { errorMessageIdOf } from '../model/list-view';
import type { StoreScope } from '../model/store-query';

/**
 * Deletes a collection of `scope`'s store, sent only while requests go to that store, then refreshes the list; a
 * refusal, a switched store included, is shown as its translated message.
 */
export function useDeleteCollection(scope: StoreScope | null, onSettled: () => void) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (collectionId: string) => deleteStoreCollection(scope, collectionId),
    onSuccess: async () => {
      toast.success(i18n._('collections.deleted'));
      await queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      toast.error(i18n._(errorMessageIdOf(error)));
    },
    onSettled,
  });
}
