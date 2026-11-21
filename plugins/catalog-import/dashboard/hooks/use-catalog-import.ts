import { isStoreSwitched, useActiveStore, useStoreScope } from '@cod/plugin-merchant-shell/shell-api';
import { CATALOG_PRODUCT_QUERY_KEY, CATALOG_PRODUCTS_QUERY_KEY } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@vendure/dashboard';
import { useCallback, useSyncExternalStore } from 'react';
import { importErrorMessageId, STORE_SWITCHED_MESSAGE_ID, UPLOAD_REFUSED_MESSAGE_ID } from '../model/import-errors';
import { type ListDialog, listDialogs } from '../model/list-dialogs';
import { UploadRefusedError } from '../queries';

/** The catalogue id of a failed request: a switched store, a refused upload, or what the API answered. */
export function failureMessageId(error: unknown): string {
  if (isStoreSwitched(error)) return STORE_SWITCHED_MESSAGE_ID;
  if (error instanceof UploadRefusedError) return UPLOAD_REFUSED_MESSAGE_ID;
  return importErrorMessageId(error);
}

/** Shows a failed request as a translated toast. */
export function useFailureToast(): (error: unknown) => void {
  const { i18n } = useLingui();
  return useCallback(
    (error: unknown) => {
      toast.error(i18n._(failureMessageId(error)));
    },
    [i18n],
  );
}

/** Refreshes the product list and editor caches after products were written (D2201 b). */
export function useProductsChanged(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    for (const queryKey of [CATALOG_PRODUCTS_QUERY_KEY, CATALOG_PRODUCT_QUERY_KEY])
      await queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);
}

/** The active store's scope, for the list's action-bar items and dialogs. */
export const useActiveScope = () => useStoreScope(useActiveStore());

/** The open list dialog (D2277). */
export function useListDialog(): ListDialog | null {
  return useSyncExternalStore(listDialogs.subscribe, listDialogs.current);
}
