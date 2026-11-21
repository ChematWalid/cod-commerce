import { MAX_ADDON_PRODUCTS, MAX_OFFER_TARGETS, type OfferTargetRole } from '@cod/shared';
import type { TargetDraft } from './editor-form';
import { withTarget } from './target-list';

/**
 * The app types with an editor of their own (D2523): `components/kinds/index.ts` maps each to its component and its
 * type requires one per id, so an id here without an editor fails the typecheck.
 */
export const KIND_EDITOR_IDS = [
  'quantity',
  'free_delivery',
  'product_discount',
  'discount_codes',
  'bxgy',
  'order_discount',
  'addon',
] as const;

export type KindEditorId = (typeof KIND_EDITOR_IDS)[number];

/** The most targets of a role: an add-on offers at most five products (D2505); the other roles only the offer cap. */
const MAX_TARGETS_OF_ROLE: Readonly<Record<OfferTargetRole, number>> = {
  buy: MAX_OFFER_TARGETS,
  get: MAX_OFFER_TARGETS,
  addon: MAX_ADDON_PRODUCTS,
};

/** The most targets the picker of `role` may hold. */
export const maxTargetsOf = (role: OfferTargetRole): number => MAX_TARGETS_OF_ROLE[role];

/** The targets with `target` added unless its role is full. */
export const addTargetOfRole = (targets: readonly TargetDraft[], target: TargetDraft): readonly TargetDraft[] =>
  withTarget(targets, target, maxTargetsOf(target.role));

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A kind's configuration as its editor reads it: the stored fields over the kind's defaults, so a field the merchant
 * is still typing (or one an older draft lacks) never blanks the card. The server validates the whole on save.
 */
export function readConfig<Config extends object>(config: unknown, defaults: Config): Config {
  return isRecord(config) ? { ...defaults, ...config } : defaults;
}

const WHOLE_NUMBER = /^\d+$/;

/** A typed whole number: `null` when blank, `undefined` when it is not a whole number. */
export function wholeNumberOf(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  return WHOLE_NUMBER.test(trimmed) ? Number(trimmed) : undefined;
}
