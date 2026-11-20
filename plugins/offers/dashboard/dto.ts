import type { OfferAppType, OfferListOptionsInput, OfferMethod, OfferPerformance, OfferStatus } from '@cod/shared';

/** The options `offers` takes: the shared list options (D2513). */
export type OfferListInput = OfferListOptionsInput;

/** An offer as the list shows it: the fields of `offers` the page asks for. */
export interface OfferRowDto {
  readonly id: string;
  readonly kind: string;
  readonly method: OfferMethod;
  readonly title: string;
  readonly status: OfferStatus;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly codeCount: number;
  readonly performance: OfferPerformance;
}

export interface OfferPageDto {
  readonly items: readonly OfferRowDto[];
  readonly totalItems: number;
}

/** A card of the create dialog, as `offerAppTypes` answers it (D2515). */
export type OfferAppTypeDto = OfferAppType;
