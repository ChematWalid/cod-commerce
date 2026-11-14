import { useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import { ACTIVE_BUSINESS_QUERY_KEY, STORE_RECORD_QUERY_KEY, SWITCHABLE_STORES_QUERY_KEY } from '../constants';
import type { BusinessPatch, StorePatch } from '../model/settings-form';
import type { BusinessRecord, StoreRecord } from '../model/types';

const UPDATE_BUSINESS_MUTATION = /* GraphQL */ `
  mutation ShellUpdateBusiness($input: UpdateBusinessInput!) {
    updateBusiness(input: $input) {
      id
      name
      logoAssetId
      logoUrl
    }
  }
`;

const UPDATE_STORE_MUTATION = /* GraphQL */ `
  mutation ShellUpdateStore($id: String!, $input: UpdateStoreInput!) {
    updateStore(id: $id, input: $input) {
      id
      name
      description
      language
      logoAssetId
      logoUrl
      showAddressField
      soldOutBehavior
    }
  }
`;

const UPLOAD_LOGO_MUTATION = /* GraphQL */ `
  mutation ShellUploadLogo($file: Upload!) {
    uploadBusinessLogo(file: $file) {
      assetId
    }
  }
`;

/** Changes the business's name or logo. The server checks `settings.business.edit`, the name and the logo's owner. */
export function useUpdateBusiness(): UseMutationResult<BusinessRecord, unknown, BusinessPatch> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input) =>
      ((await api.mutate(UPDATE_BUSINESS_MUTATION, { input })) as { readonly updateBusiness: BusinessRecord })
        .updateBusiness,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ACTIVE_BUSINESS_QUERY_KEY });
    },
  });
}

/**
 * Changes the store `storeId`. The server checks `store.settings.edit`. After a save the switcher's list is stale (its
 * name and language come from there), so it is refetched.
 */
export function useUpdateStore(storeId: string): UseMutationResult<StoreRecord, unknown, StorePatch> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input) =>
      ((await api.mutate(UPDATE_STORE_MUTATION, { id: storeId, input })) as { readonly updateStore: StoreRecord })
        .updateStore,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SWITCHABLE_STORES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: STORE_RECORD_QUERY_KEY }),
      ]);
    },
  });
}

/**
 * Uploads a logo image on the active store's channel and answers with its asset id, which a Save then sets. The server
 * checks `settings.business.edit`, the size and the content (D34, D2120).
 */
export function useUploadLogo(): UseMutationResult<string, unknown, File> {
  return useMutation({
    mutationFn: async (file) =>
      (
        (await api.mutate(UPLOAD_LOGO_MUTATION, { file })) as {
          readonly uploadBusinessLogo: { readonly assetId: string };
        }
      ).uploadBusinessLogo.assetId,
  });
}
