import type { OfferCommand, Snowflake } from '@cod/shared';
import type { Offer } from './offer';

/**
 * An offer as the store keeps it (D2405): what the engine reads plus the admin fields. `version` grows on every write
 * so a later cache can key on it (D2424); `usageCount` is never written here (D2418).
 */
export interface OfferRecord extends Offer {
  readonly id: Snowflake;
  readonly pausedAt: Date | null;
  readonly archivedAt: Date | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** An offer as the admin list shows it (D2513): with how many codes it holds, counted on read (D2529). */
export interface OfferSummaryRecord extends OfferRecord {
  readonly codeCount: number;
}

/** A discount code of one offer, stored trimmed and upper-cased (D2406). */
export interface StoredCode {
  readonly id: Snowflake;
  readonly offerId: Snowflake;
  readonly code: string;
  readonly usageLimit: number | null;
  readonly usageCount: number;
  readonly createdAt: Date;
}

const instantOf = (value: string | null): Date | null => (value === null ? null : new Date(value));

/** The fields an admin command sets, with instants parsed to UTC dates (D2419). */
function commandFields(command: OfferCommand, config: unknown) {
  return {
    kind: command.kind,
    method: command.method,
    title: command.title,
    label: command.label,
    config,
    combinesWith: command.combinesWith,
    eligibility: command.eligibility,
    totalUsageLimit: command.totalUsageLimit,
    perBuyerLimit: command.perBuyerLimit,
    startsAt: instantOf(command.startsAt),
    endsAt: instantOf(command.endsAt),
    targets: command.targets,
  };
}

/** What makes a new draft: its id, the validated command, the kind-parsed config and the instant. */
export interface DraftInput {
  readonly id: Snowflake;
  readonly command: OfferCommand;
  readonly config: unknown;
  readonly now: Date;
}

/** A new draft offer: unpublished, unused, version 1. */
export function draftOf({ id, command, config, now }: DraftInput): OfferRecord {
  return {
    id,
    ...commandFields(command, config),
    status: 'draft',
    publishedAt: null,
    pausedAt: null,
    archivedAt: null,
    usageCount: 0,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * A new draft copying `source`'s kind, method, texts, config, combination, eligibility, limits, dates and targets
 * (D2511): unpublished, unused, version 1, made at `now`. Codes are the caller's: they are unique per store.
 */
export function duplicateOf(source: OfferRecord, id: Snowflake, now: Date): OfferRecord {
  return {
    ...source,
    id,
    targets: source.targets.map((target) => ({ ...target })),
    status: 'draft',
    publishedAt: null,
    pausedAt: null,
    archivedAt: null,
    usageCount: 0,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/** `current` with the fields of an edit command, its version bumped. */
export function editedOffer(current: OfferRecord, command: OfferCommand, config: unknown, now: Date): OfferRecord {
  return { ...current, ...commandFields(command, config), version: current.version + 1, updatedAt: now };
}

const isoOf = (value: Date | null): string | null => (value === null ? null : value.toISOString());

/** The editable fields of `offer` in input form, so an edit can be a patch over them. */
export function inputOf(offer: OfferRecord) {
  const { kind, method, title, label, config, combinesWith, eligibility, totalUsageLimit, perBuyerLimit } = offer;
  const targets = offer.targets.map((target) => ({ ...target }));
  const startsAt = isoOf(offer.startsAt);
  const endsAt = isoOf(offer.endsAt);
  return {
    kind,
    method,
    title,
    label,
    config,
    combinesWith,
    eligibility,
    totalUsageLimit,
    perBuyerLimit,
    targets,
    startsAt,
    endsAt,
  };
}
