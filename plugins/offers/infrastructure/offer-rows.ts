import {
  OFFER_TARGET_ROLES,
  type OfferTarget,
  type OfferTargetRole,
  type Snowflake,
  TARGET_REF_TYPES,
  type TargetRefType,
  toSnowflake,
} from '@cod/shared';
import { InvalidOfferConfigError } from '../domain/errors';
import type { OfferRecord } from '../domain/offer-record';
import type { PricingLogger } from '../domain/ports/pricing-logger.port';
import type { StoreScope } from '../domain/store-scope';
import type { OfferEntity } from './offer.entity';
import type { OfferTargetEntity } from './offer-target.entity';
import { inStore } from './store-where';

/** The columns of an `offers_offer` row the repository writes; `TenantRepository` adds the business. */
export type OfferRow = Omit<OfferEntity, 'businessId'>;
/** The columns of an `offers_offer_target` row the repository writes. */
export type OfferTargetRow = Omit<OfferTargetEntity, 'businessId' | 'offer'>;

const REF_TYPES: ReadonlySet<string> = new Set(TARGET_REF_TYPES);
const ROLES: ReadonlySet<string> = new Set(OFFER_TARGET_ROLES);

/** The columns an edit rewrites: all but the business, store, id, configuration, creation instant and usage count. */
type EditableOfferFields = Omit<OfferEntity, 'businessId' | 'storeId' | 'id' | 'config' | 'createdAt' | 'usageCount'>;

function editableFieldsOf(source: EditableOfferFields): EditableOfferFields {
  const { kind, method, title, label, combinesWith, eligibility, totalUsageLimit, perBuyerLimit, status } = source;
  const { startsAt, endsAt, publishedAt, pausedAt, archivedAt, version, updatedAt } = source;
  return {
    ...{ kind, method, title, label, combinesWith, eligibility, totalUsageLimit, perBuyerLimit, status },
    ...{ startsAt, endsAt, publishedAt, pausedAt, archivedAt, version, updatedAt },
  };
}

const isJsonObject = (value: unknown): value is object =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The columns an edit of `offer` in `scope` writes (not its id, creation instant or usage count, D2418).
 *
 * @throws {@link InvalidOfferConfigError} when the configuration is not an object, which no kind's schema outputs.
 */
export function editableRowOf(
  scope: StoreScope,
  offer: OfferRecord,
): Omit<OfferRow, 'id' | 'createdAt' | 'usageCount'> {
  if (!isJsonObject(offer.config)) throw new InvalidOfferConfigError();
  return { ...editableFieldsOf(offer), config: offer.config, ...inStore(scope) };
}

/** The `offers_offer` row of `offer` in `scope`; targets are rows of their own. */
export function offerRowOf(scope: StoreScope, offer: OfferRecord): OfferRow {
  const { id, createdAt, usageCount } = offer;
  return { ...editableRowOf(scope, offer), id, createdAt, usageCount };
}

/** The target rows of `offer` in `scope`, numbered in their order, each with a fresh id. */
export function targetRowsOf(scope: StoreScope, offer: OfferRecord, nextId: () => Snowflake): OfferTargetRow[] {
  return offer.targets.map((target, position) => ({
    id: nextId(),
    ...inStore(scope),
    offerId: offer.id,
    role: target.role,
    refType: target.refType,
    refId: target.refId,
    position,
  }));
}

/**
 * The target of a stored row, or `undefined` (logged) for a `refType` or `role` the engine does not know: a bad row
 * must neither match every line nor abort a quote (Task 10 Step 1c, D2404).
 */
function targetOf(row: OfferTargetEntity, logger: PricingLogger): OfferTarget | undefined {
  if (!REF_TYPES.has(row.refType) || !ROLES.has(row.role)) {
    logger.unknownTarget(row.offerId, row.refType, row.role);
    return undefined;
  }
  return { role: row.role as OfferTargetRole, refType: row.refType as TargetRefType, refId: row.refId };
}

/** The offer of a stored row and its target rows (any order), targets sorted by position. */
export function toOfferRecord(
  row: OfferEntity,
  targetRows: readonly OfferTargetEntity[],
  logger: PricingLogger,
): OfferRecord {
  const targets = [...targetRows]
    .sort((left, right) => left.position - right.position)
    .flatMap((target) => targetOf(target, logger) ?? []);
  const { config, createdAt, usageCount } = row;
  return { ...editableFieldsOf(row), id: toSnowflake(row.id), config, createdAt, usageCount, targets };
}
