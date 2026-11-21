import { isStoreSwitched, type StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@vendure/dashboard';
import { PACK_PRODUCT_QUERY_KEY, PACK_QUERY_KEY } from '../constants';
import { packErrorMessageId, STORE_SWITCHED_MESSAGE_ID } from '../model/pack-errors';
import {
  PACK_SAVE_INVALIDATES,
  type PackForm,
  type PackFormErrors,
  packFormErrors,
  packInputOf,
} from '../model/pack-form';
import { saveCatalogPack } from '../queries';

/** The catalogue id of a failed pack request: a switched store, or what the pack API answered. */
export const packFailureMessageId = (error: unknown): string =>
  isStoreSwitched(error) ? STORE_SWITCHED_MESSAGE_ID : packErrorMessageId(error);

/** Raised when the form is refused before any request; its fields are already shown. */
class PackFormInvalid extends Error {
  constructor() {
    super('The pack form has refused fields');
    this.name = 'PackFormInvalid';
  }
}

/**
 * Saves the pack of `productId`. A refused form shows its fields without a request; after a save the product's
 * editor and list caches are refreshed (D2201 b), since catalog-packs rewrote its price, weight and variants.
 */
export function usePackSave(scope: StoreScope | null, productId: string, onErrors: (errors: PackFormErrors) => void) {
  const { i18n } = useLingui();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (form: PackForm) => {
      const errors = packFormErrors(form);
      onErrors(errors);
      if (Object.keys(errors).length > 0) throw new PackFormInvalid();
      return saveCatalogPack(scope, productId, packInputOf(form));
    },
    onSuccess: async () => {
      for (const queryKey of [...PACK_SAVE_INVALIDATES, PACK_QUERY_KEY, PACK_PRODUCT_QUERY_KEY])
        await queryClient.invalidateQueries({ queryKey });
      toast.success(i18n._('packs.saved'));
    },
    onError: (error: unknown) => {
      toast.error(i18n._(error instanceof PackFormInvalid ? 'packs.fix-errors' : packFailureMessageId(error)));
    },
  });
}
