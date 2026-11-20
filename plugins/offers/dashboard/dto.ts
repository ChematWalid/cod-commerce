import type {
  CombinesWith,
  OfferAppType,
  OfferEligibility,
  OfferLabel,
  OfferListOptionsInput,
  OfferMethod,
  OfferPerformance,
  OfferStatus,
  OfferTarget,
} from '@cod/shared';

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

/** An offer as the editor reads it back after a load or a save (`OfferView`, D2519). */
export interface OfferViewDto {
  readonly id: string;
  readonly kind: string;
  readonly method: OfferMethod;
  readonly title: string;
  readonly label: OfferLabel;
  readonly config: unknown;
  readonly combinesWith: CombinesWith;
  readonly eligibility: OfferEligibility;
  readonly totalUsageLimit: number | null;
  readonly perBuyerLimit: number | null;
  readonly status: OfferStatus;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly version: number;
  readonly targets: readonly OfferTarget[];
  readonly codeCount: number;
}

/** A product of the target search (`catalogProducts`), and one opened to pick a variant (`catalogProduct`). */
export interface TargetProductDto {
  readonly id: string;
  readonly title: string;
  readonly price: number;
}

export interface TargetVariantDto {
  readonly id: string;
  readonly name: string;
  readonly price: number;
}

export interface TargetProductDetailDto extends TargetProductDto {
  readonly variants: readonly TargetVariantDto[];
}
