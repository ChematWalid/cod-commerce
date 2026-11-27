import { isStoreSwitched, type StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import type { WilayaCode } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@vendure/dashboard';
import { FEE_GROUP_QUERY_KEY, FEE_GROUPS_QUERY_KEY, PRICING_TEMPLATE_QUERY_KEY } from '../constants';
import type { FeeGroupDto } from '../dto';
import { type CommuneRow, communeInputOf } from '../model/commune-form';
import { errorMessageIdOf, STORE_SWITCHED_MESSAGE_ID } from '../model/list-view';
import type { PricingForm } from '../model/pricing-form';
import { pricingInputOf } from '../model/pricing-input';
import { createFeeGroup, deleteFeeGroup, setCommuneRates, updateFeeGroup } from '../queries';

/** The catalogue id of a failed request: a switched store, or what the delivery-pricing API answered. */
export const failureMessageIdOf = (error: unknown): string =>
  isStoreSwitched(error) ? STORE_SWITCHED_MESSAGE_ID : errorMessageIdOf(error);

/** Raised when the form is refused before any request; its fields are already shown. */
class FormInvalid extends Error {
  constructor() {
    super('The pricing form has refused fields');
    this.name = 'FormInvalid';
  }
}

const FIX_ERRORS_MESSAGE_ID = 'delivery-pricing.fix-errors';
const messageIdOf = (error: unknown): string =>
  error instanceof FormInvalid ? FIX_ERRORS_MESSAGE_ID : failureMessageIdOf(error);

/** Every cached read a write can change: the list, the option and the template. */
export function useRefreshAll() {
  const queryClient = useQueryClient();
  return async (): Promise<void> => {
    for (const queryKey of [FEE_GROUPS_QUERY_KEY, FEE_GROUP_QUERY_KEY, PRICING_TEMPLATE_QUERY_KEY])
      await queryClient.invalidateQueries({ queryKey });
  };
}

interface SaveOptions {
  readonly scope: StoreScope | null;
  /** The option's id, or null for a new one (created by the save). */
  readonly groupId: string | null;
  readonly onErrors: (errors: ReadonlySet<string>) => void;
  readonly onSaved: (group: FeeGroupDto) => void;
}

/** Creates or saves a pricing option; a refused form shows its fields without a request. */
export function usePricingSave({ scope, groupId, onErrors, onSaved }: SaveOptions) {
  const { i18n } = useLingui();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: async (form: PricingForm) => {
      const submit = pricingInputOf(form);
      onErrors(submit.ok ? new Set() : submit.errors);
      if (!submit.ok) throw new FormInvalid();
      return groupId === null ? createFeeGroup(scope, submit.input) : updateFeeGroup(scope, groupId, submit.input);
    },
    onSuccess: async (group) => {
      toast.success(i18n._('delivery-pricing.saved'));
      await refresh();
      onSaved(group);
    },
    onError: (error: unknown) => {
      toast.error(i18n._(messageIdOf(error)));
    },
  });
}

/** Deletes a pricing option of `scope`'s store, then refreshes the list. */
export function useDeletePricing(scope: StoreScope | null, onSettled: () => void) {
  const { i18n } = useLingui();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (groupId: string) => deleteFeeGroup(scope, groupId),
    onSuccess: async () => {
      toast.success(i18n._('delivery-pricing.deleted'));
      await refresh();
    },
    onError: (error: unknown) => {
      toast.error(i18n._(failureMessageIdOf(error)));
    },
    onSettled,
  });
}

interface CommuneSaveOptions {
  readonly scope: StoreScope | null;
  readonly groupId: string;
  readonly provinceCode: WilayaCode;
  readonly onErrors: (errors: ReadonlySet<number>) => void;
}

/** Saves the communes of one wilaya through `setDeliveryFeeCommuneRates` (D3125). */
export function useCommuneSave({ scope, groupId, provinceCode, onErrors }: CommuneSaveOptions) {
  const { i18n } = useLingui();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: async (rows: readonly CommuneRow[]) => {
      const submit = communeInputOf(provinceCode, rows);
      onErrors(submit.ok ? new Set() : submit.errors);
      if (!submit.ok) throw new FormInvalid();
      return setCommuneRates(scope, groupId, submit.input);
    },
    onSuccess: async () => {
      toast.success(i18n._('delivery-pricing.communes-saved'));
      await refresh();
    },
    onError: (error: unknown) => {
      toast.error(i18n._(messageIdOf(error)));
    },
  });
}
