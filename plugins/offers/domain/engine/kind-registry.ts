import type {
  AddonPlacement,
  CombinationClass,
  Nudge,
  OfferConfigWarning,
  OfferTargetRole,
  Suggestion,
} from '@cod/shared';
import type { ZodType } from 'zod';
import { InvalidOfferConfigError, UnknownOfferKindError } from '../errors';
import type { KindInput, OfferOutcome } from './outcome';

/**
 * Which target roles an offer of a kind may hold, and which it needs before it is published (D2501). `allowed` is
 * enforced on every create and update; `required` only at publish, so a draft may stay incomplete.
 */
export interface TargetRules {
  readonly allowed: readonly OfferTargetRole[];
  readonly required: readonly OfferTargetRole[];
  /** Most targets of a role the offer may hold, enforced with `allowed` (an add-on offer's products, D2505). */
  readonly maxPerRole?: Readonly<Partial<Record<OfferTargetRole, number>>>;
}

/** Whether every target's role is allowed and no role holds more targets than its maximum (D2501, D2505). */
export function fitsTargetRules(targets: readonly { readonly role: OfferTargetRole }[], rules: TargetRules): boolean {
  if (targets.some((target) => !rules.allowed.includes(target.role))) return false;
  const { maxPerRole = {} } = rules;
  return rules.allowed.every((role) => {
    const max = maxPerRole[role];
    return max === undefined || targets.filter((target) => target.role === role).length <= max;
  });
}

/** A configuration parsed by its kind's schema, with the target rules that configuration gives (D2501). */
export interface ParsedKindConfig {
  readonly config: unknown;
  readonly rules: TargetRules;
}

/** One synthetic cart the admin preview prices for a kind (D2516): its pieces and the extra lines it holds. */
export interface PreviewCart {
  /** Every piece of the cart, a get line's included. */
  readonly pieces: number;
  readonly withGet: boolean;
  /** How many of `pieces` the get line holds when `withGet` (`PREVIEW_GET_PIECES` when unset, D2534). */
  readonly getPieces?: number;
  readonly withAddon: boolean;
}

/** The cart a kind without a `previewCarts` hook is previewed on: one piece, no get line and no add-on (D2516). */
export const DEFAULT_PREVIEW_CARTS: readonly PreviewCart[] = [{ pieces: 1, withGet: false, withAddon: false }];

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
  /** The target roles an offer of this kind with `config` may hold and needs (D2501). */
  targetRules(config: C): TargetRules;
  /** Set when an accepted outcome never competes with another offer, as an add-on the buyer chose (D2507). */
  readonly combinesAlways?: true;
  /** The carts the admin preview prices for `config` (D2516); one cart of one piece when absent. */
  previewCarts?(config: C): readonly PreviewCart[];
  /** Configurations the engine prices, but likely not as the merchant meant (D2516). */
  configWarnings?(config: C): readonly OfferConfigWarning[];
  /** Set on a kind that offers add-ons: where an offer with `config` offers them (D2506). */
  addonPlacement?(config: C): AddonPlacement;
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
    return parseWith(this.calculatorOf(kind), raw);
  }

  /**
   * The target rules of `kind` for the configuration `raw` (D2501).
   *
   * @throws {@link UnknownOfferKindError} when no calculator handles `kind`.
   * @throws {@link InvalidOfferConfigError} when the schema rejects `raw`.
   */
  targetRulesOf(kind: string, raw: unknown): TargetRules {
    return this.parsedWithRules(kind, raw).rules;
  }

  /**
   * `raw` parsed once with the schema of `kind`, and the target rules of the result (D2501). Callers that need both
   * use this instead of parsing again, since a schema's transforms need not be idempotent.
   *
   * @throws {@link UnknownOfferKindError} when no calculator handles `kind`.
   * @throws {@link InvalidOfferConfigError} when the schema rejects `raw`.
   */
  parsedWithRules(kind: string, raw: unknown): ParsedKindConfig {
    const calculator = this.calculatorOf(kind);
    const config = parseWith(calculator, raw);
    return { config, rules: calculator.targetRules(config) };
  }

  private calculatorOf(kind: string): OfferKindCalculator<unknown> {
    const calculator = this.byKind.get(kind);
    if (calculator === undefined) throw new UnknownOfferKindError();
    return calculator;
  }
}

/** `raw` parsed with `calculator`'s schema; @throws {@link InvalidOfferConfigError} when it rejects it. */
function parseWith(calculator: OfferKindCalculator<unknown>, raw: unknown): unknown {
  const parsed = calculator.configSchema.safeParse(raw);
  if (!parsed.success) throw new InvalidOfferConfigError();
  return parsed.data;
}
