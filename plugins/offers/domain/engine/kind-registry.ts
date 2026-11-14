import type { CombinationClass, Nudge, Suggestion } from '@cod/shared';
import type { ZodType } from 'zod';
import { InvalidOfferConfigError, UnknownOfferKindError } from '../errors';
import type { KindInput, OfferOutcome } from './outcome';

/**
 * One offer kind (D2404, §3a.7): its combination class, pipeline stage, config schema and effect. A new kind is a
 * new calculator in the `BUILT_IN_OFFER_KINDS` array, never a branch in a shared switch.
 */
export interface OfferKindCalculator<C> {
  readonly kind: string;
  readonly combinationClass: CombinationClass;
  /** Order in which accepted outcomes are applied, ascending (`STAGE_*` of `@cod/shared`). */
  readonly stage: number;
  readonly configSchema: ZodType<C>;
  evaluate(input: KindInput<C>): OfferOutcome;
  nudge?(input: KindInput<C>): Nudge | null;
  suggest?(input: KindInput<C>): Suggestion | null;
}

/** The calculators by kind; the engine and the admin use case look kinds up here, never by name in code. */
export class OfferKindRegistry {
  private readonly byKind: ReadonlyMap<string, OfferKindCalculator<unknown>>;

  /** @throws Error when two calculators claim one kind: a wiring bug, caught at boot. */
  constructor(calculators: readonly OfferKindCalculator<unknown>[]) {
    const byKind = new Map<string, OfferKindCalculator<unknown>>();
    for (const calculator of calculators) {
      if (byKind.has(calculator.kind)) throw new Error(`Offer kind registered twice: ${calculator.kind}`);
      byKind.set(calculator.kind, calculator);
    }
    this.byKind = byKind;
  }

  /** The calculator of `kind`, or `undefined` when none handles it. */
  get(kind: string): OfferKindCalculator<unknown> | undefined {
    return this.byKind.get(kind);
  }

  /** Every registered kind, in registration order. */
  kinds(): readonly string[] {
    return [...this.byKind.keys()];
  }

  /**
   * `raw` parsed with the schema of `kind`.
   *
   * @throws {@link UnknownOfferKindError} when no calculator handles `kind`.
   * @throws {@link InvalidOfferConfigError} when the schema rejects `raw`.
   */
  parseConfig(kind: string, raw: unknown): unknown {
    const calculator = this.byKind.get(kind);
    if (calculator === undefined) throw new UnknownOfferKindError();
    const parsed = calculator.configSchema.safeParse(raw);
    if (!parsed.success) throw new InvalidOfferConfigError();
    return parsed.data;
  }
}
