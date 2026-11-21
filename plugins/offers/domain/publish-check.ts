import { PUBLISH_PROBLEMS, type PublishProblem } from '@cod/shared';
import type { OfferKindRegistry, TargetRules } from './engine/kind-registry';
import { OfferPublishInvalidError } from './errors';
import type { OfferRecord } from './offer-record';

/** Whether the schedule can still run: an end after now, and after the start when both are set. */
function hasValidDates({ startsAt, endsAt }: OfferRecord, now: Date): boolean {
  if (endsAt === null) return true;
  if (endsAt.getTime() <= now.getTime()) return false;
  return startsAt === null || startsAt.getTime() < endsAt.getTime();
}

/** Whether every role the kind requires holds at least one target (D2501). */
const hasRequiredTargets = (offer: OfferRecord, rules: TargetRules): boolean =>
  rules.required.every((role) => offer.targets.some((target) => target.role === role));

/** Each publish problem and whether `offer` has it at `now`. */
const CHECKS: Readonly<Record<PublishProblem, (offer: OfferRecord, rules: TargetRules, now: Date) => boolean>> = {
  title: (offer) => offer.title.trim() === '',
  targets: (offer, rules) => !hasRequiredTargets(offer, rules),
  dates: (offer, _rules, now) => !hasValidDates(offer, now),
};

/**
 * What keeps `offer` from being live at `now` under its kind's target `rules` (D2510): every problem at once, in
 * {@link PUBLISH_PROBLEMS} order; empty when it may be published.
 */
export function publishProblems(offer: OfferRecord, rules: TargetRules, now: Date): PublishProblem[] {
  return PUBLISH_PROBLEMS.filter((problem) => CHECKS[problem](offer, rules, now));
}

/**
 * Refuses an offer that cannot be live at `now` (D2510): its config re-parsed by its kind first, then every publish
 * problem collected.
 *
 * @throws {@link InvalidOfferConfigError} when the stored config no longer passes its kind's schema.
 * @throws {@link UnknownOfferKindError} when no calculator handles the kind.
 * @throws {@link OfferPublishInvalidError} listing every problem found.
 */
export function assertPublishable(offer: OfferRecord, kinds: OfferKindRegistry, now: Date): void {
  assertNoPublishProblems(offer, kinds.parsedWithRules(offer.kind, offer.config).rules, now);
}

/** @throws {@link OfferPublishInvalidError} listing every {@link publishProblems} of `offer`, when it has any. */
export function assertNoPublishProblems(offer: OfferRecord, rules: TargetRules, now: Date): void {
  const problems = publishProblems(offer, rules, now);
  if (problems.length > 0) throw new OfferPublishInvalidError(problems);
}
