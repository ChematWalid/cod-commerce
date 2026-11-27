/** A pricing option of the active store, as the Default delivery fee group select lists it. */
export interface FeeGroupOption {
  readonly id: string;
  readonly name: string;
}

/** One page of `deliveryFeeGroups` as the select reads it. */
export interface FeeGroupOptionPage {
  readonly items: readonly FeeGroupOption[];
  readonly totalItems: number;
}

/**
 * What the Default delivery fee group field shows: the store's options to choose from, or only whether one is set.
 * The names come from `deliveryFeeGroups`, which needs `delivery.pricing.view`; without it there is nothing to name.
 */
export type FeeGroupFieldView =
  { readonly kind: 'choose'; readonly options: readonly FeeGroupOption[] } | { readonly kind: 'status' };

/** The field's view: the options once they are loaded for a caller who may see them, otherwise the neutral status. */
export function feeGroupFieldView(
  canViewPricing: boolean,
  options: readonly FeeGroupOption[] | undefined,
): FeeGroupFieldView {
  return canViewPricing && options !== undefined ? { kind: 'choose', options } : { kind: 'status' };
}

/** The catalogue id of the neutral status: whether the store has a default delivery fee group. */
export const feeGroupStatusLabelId = (defaultDeliveryFeeGroupId: string | null): string =>
  defaultDeliveryFeeGroupId === null ? 'shell.settings.store.fee-group-not-set' : 'shell.settings.store.fee-group-set';

/** Every pricing option of the store: the list pages are read in turn, stopping on an empty page or past the total. */
export async function readAllFeeGroups(
  fetchPage: (skip: number, take: number) => Promise<FeeGroupOptionPage>,
  take: number,
): Promise<readonly FeeGroupOption[]> {
  const read: FeeGroupOption[] = [];
  for (let skip = 0; ; skip += take) {
    const page = await fetchPage(skip, take);
    read.push(...page.items);
    if (page.items.length === 0 || skip + take >= page.totalItems) return read;
  }
}
