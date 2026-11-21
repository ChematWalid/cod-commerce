import { MAX_OFFER_TARGETS, type OfferTargetRole } from '@cod/shared';
import type { TargetDraft } from './editor-form';

const sameTarget = (a: TargetDraft, b: TargetDraft): boolean =>
  a.role === b.role && a.refType === b.refType && a.refId === b.refId;

/** The targets of one role, in the order they were added. */
export const targetsOfRole = (targets: readonly TargetDraft[], role: OfferTargetRole): readonly TargetDraft[] =>
  targets.filter((target) => target.role === role);

/**
 * The targets with `target` added at the end, unchanged when it is already there or when its role already holds
 * `maxOfRole` targets (an add-on offers at most five products, D2505) or the offer holds the most targets it can.
 */
export function withTarget(
  targets: readonly TargetDraft[],
  target: TargetDraft,
  maxOfRole: number = MAX_OFFER_TARGETS,
): readonly TargetDraft[] {
  if (targets.some((each) => sameTarget(each, target))) return targets;
  if (targetsOfRole(targets, target.role).length >= maxOfRole || targets.length >= MAX_OFFER_TARGETS) return targets;
  return [...targets, target];
}

/** The targets without `target`. */
export const withoutTarget = (targets: readonly TargetDraft[], target: TargetDraft): readonly TargetDraft[] =>
  targets.filter((each) => !sameTarget(each, target));
