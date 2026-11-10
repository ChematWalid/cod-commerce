import { useMutation, type UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import { ACTIVE_BUSINESS_QUERY_KEY, STORE_RECORD_QUERY_KEY, SWITCHABLE_STORES_QUERY_KEY } from '../constants';
import type { StorePatch } from '../model/settings-form';
import type { BusinessRecord, StoreRecord } from '../model/types';

const UPDATE_BUSINESS_MUTATION = /* GraphQL */ `
  mutation ShellUpdateBusiness($input: UpdateBusinessInput!) {
    updateBusiness(input: $input) {
      id
      name
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
    }
  }
`;

/** Renames the business. The server checks `settings.business.edit` and the name. */
export function useUpdateBusiness(): UseMutationResult<BusinessRecord, unknown, { readonly name: string }> {
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
