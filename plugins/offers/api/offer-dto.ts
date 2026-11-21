import type {
  CombinesWith,
  OfferEligibility,
  OfferLabel,
  OfferMethod,
  OfferPerformance,
  OfferStatus,
  OfferTarget,
} from '@cod/shared';
import { allowedMovesOf, isDeletableStatus, isEditableStatus, type OfferMove } from '../domain/offer-lifecycle';
import type { OfferSummaryRecord, StoredCode } from '../domain/offer-record';

/** One offer as both API surfaces answer it (`OfferView`, D2519): ids as text, instants as ISO text. */
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
  readonly publishedAt: string | null;
  readonly pausedAt: string | null;
  readonly archivedAt: string | null;
  readonly usageCount: number;
  readonly version: number;
  readonly targets: readonly OfferTarget[];
  readonly codeCount: number;
  readonly performance: OfferPerformance;
  /** The lifecycle moves the offer's status allows (D2543); the caller's permissions are checked apart. */
  readonly allowedMoves: readonly OfferMove[];
  /** Whether the offer may still be edited: not once archived. */
  readonly editable: boolean;
  /** Whether the offer may be deleted: a draft only (D2521). */
  readonly deletable: boolean;
}

/** A list page (`OfferPage`, D2513). */
export interface OfferPageDto {
  readonly items: readonly OfferViewDto[];
  readonly totalItems: number;
}

/** One discount code (`OfferCodeView`). */
export interface OfferCodeDto {
  readonly id: string;
  readonly offerId: string;
  readonly code: string;
  readonly usageLimit: number | null;
  readonly usageCount: number;
  readonly createdAt: string;
}

/** What a deletion answers on REST. */
export interface SuccessDto {
  readonly success: boolean;
}

const isoOf = (instant: Date | null): string | null => (instant === null ? null : instant.toISOString());

/** The DTO of an offer with its code count and its performance (D2513, D2514). */
export function toOfferViewDto(offer: OfferSummaryRecord, performance: OfferPerformance): OfferViewDto {
  return {
    id: offer.id,
    kind: offer.kind,
    method: offer.method,
    title: offer.title,
    label: offer.label,
    config: offer.config,
    combinesWith: offer.combinesWith,
    eligibility: offer.eligibility,
    totalUsageLimit: offer.totalUsageLimit,
    perBuyerLimit: offer.perBuyerLimit,
    status: offer.status,
    startsAt: isoOf(offer.startsAt),
    endsAt: isoOf(offer.endsAt),
    publishedAt: isoOf(offer.publishedAt),
    pausedAt: isoOf(offer.pausedAt),
    archivedAt: isoOf(offer.archivedAt),
    usageCount: offer.usageCount,
    version: offer.version,
    targets: offer.targets.map((target) => ({ ...target })),
    codeCount: offer.codeCount,
    performance: { ...performance },
    allowedMoves: allowedMovesOf(offer.status),
    editable: isEditableStatus(offer.status),
    deletable: isDeletableStatus(offer.status),
  };
}

/** The DTO of a stored code. */
export function toCodeDto(code: StoredCode): OfferCodeDto {
  return { ...code, createdAt: code.createdAt.toISOString() };
}
