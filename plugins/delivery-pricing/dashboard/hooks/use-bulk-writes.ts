import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import type { DeliveryFeeCommunePricesInput, DeliveryFeePriceAdjustmentInput } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { useMutation } from '@tanstack/react-query';
import { toast } from '@vendure/dashboard';
import type { FeeGroupDto } from '../dto';
import { adjustFeeGroupPrices, duplicateFeeGroup, setProvinceCommunePrices } from '../queries';
import { failureMessageIdOf, useRefreshAll } from './use-pricing-writes';

interface GroupWriteOptions {
  readonly scope: StoreScope | null;
  readonly groupId: string;
}

/** "Raise/lower by…" (D3140); `onDone` receives the option as the server wrote it. */
export function useAdjustPrices({
  scope,
  groupId,
  onDone,
}: GroupWriteOptions & { onDone: (group: FeeGroupDto) => void }) {
  const { i18n } = useLingui();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: DeliveryFeePriceAdjustmentInput) => adjustFeeGroupPrices(scope, groupId, input),
    onSuccess: async (group) => {
      toast.success(i18n._('delivery-pricing.adjusted'));
      await refresh();
      onDone(group);
    },
    onError: (error: unknown) => {
      toast.error(i18n._(failureMessageIdOf(error)));
    },
  });
}

/**
 * "Set price for all communes" of one wilaya (D3140). The write moves the option's `updatedAt` and its commune rows,
 * so once the option is refreshed the commune editor remounts (keyed by `communeEditorKeyOf`) with the new prices.
 */
export function useCommunePrices({ scope, groupId }: GroupWriteOptions) {
  const { i18n } = useLingui();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: (input: DeliveryFeeCommunePricesInput) => setProvinceCommunePrices(scope, groupId, input),
    onSuccess: async () => {
      toast.success(i18n._('delivery-pricing.commune-prices-saved'));
      await refresh();
    },
    onError: (error: unknown) => {
      toast.error(i18n._(failureMessageIdOf(error)));
    },
  });
}

/** "Copy" a pricing option of `scope`'s store (D3140), then refreshes the list. */
export function useDuplicatePricing(scope: StoreScope | null, onSettled: () => void) {
  const { i18n } = useLingui();
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: ({ groupId, name }: { readonly groupId: string; readonly name: string }) =>
      duplicateFeeGroup(scope, groupId, name),
    onSuccess: async () => {
      toast.success(i18n._('delivery-pricing.copied'));
      await refresh();
    },
    onError: (error: unknown) => {
      toast.error(i18n._(failureMessageIdOf(error)));
    },
    onSettled,
  });
}
