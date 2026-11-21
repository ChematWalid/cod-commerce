import type { LineDiscount, QuoteLine } from '@cod/shared';
import { giftLineKey, type RunningLine } from '../cart';
import type { AddonOutcome, GiftOutcome, LineOutcome } from './outcome';
import type { TokenAddon, TokenLine } from './priced-quote';

/** The discounts each line got, by line key, in the order they applied. */
export type LineDiscounts = ReadonlyMap<string, readonly LineDiscount[]>;

/** What applying one line outcome gives: the new running lines, the discounts and the line saving. */
export interface AppliedLineOutcome {
  readonly lines: readonly RunningLine[];
  readonly lineDiscounts: LineDiscounts;
  readonly saving: number;
}

/** What `applyLineOutcome` reads. */
export interface LineOutcomeInput {
  readonly lines: readonly RunningLine[];
  readonly lineDiscounts: LineDiscounts;
  readonly outcome: LineOutcome;
  /** The offer the discount is reported under. */
  readonly source: Omit<LineDiscount, 'amount'>;
}

/** The per-unit discount actually taken from `line`: never negative, never more than its running unit price. */
const takenFrom = (line: RunningLine, outcome: LineOutcome): number =>
  Math.min(Math.max(outcome.unitDiscounts.get(line.key) ?? 0, 0), line.unitPrice);

/**
 * Takes the outcome's per-unit discounts off the running unit prices (D2411: an accepted line offer stacks on the
 * price earlier stages reached) and records each non-zero one as a line discount for the whole line.
 */
export function applyLineOutcome({ lines, lineDiscounts, outcome, source }: LineOutcomeInput): AppliedLineOutcome {
  const discounts = new Map(lineDiscounts);
  const taken = lines.map((line) => ({ line, perUnit: takenFrom(line, outcome) }));
  for (const { line, perUnit } of taken) {
    if (perUnit === 0) continue;
    discounts.set(line.key, [...(discounts.get(line.key) ?? []), { ...source, amount: perUnit * line.quantity }]);
  }
  return {
    lines: taken.map(({ line, perUnit }) => ({ ...line, unitPrice: line.unitPrice - perUnit })),
    lineDiscounts: discounts,
    saving: taken.reduce((sum, { line, perUnit }) => sum + perUnit * line.quantity, 0),
  };
}

/** What `applyGiftOutcome` reads. */
export interface GiftOutcomeInput {
  readonly lines: readonly RunningLine[];
  readonly lineDiscounts: LineDiscounts;
  readonly outcome: GiftOutcome;
  /** The offer the gift is reported under. */
  readonly source: Omit<LineDiscount, 'amount'>;
}

/** One matched line split into what stays paid (none when every unit is gifted) and its gift line. */
interface SplitLine {
  readonly paid: RunningLine | null;
  readonly gift: RunningLine;
  readonly saving: number;
}

/**
 * `discounts` of a line of `from` units rescaled to `to` units: each was taken per unit over the whole line (D2411),
 * so the per-unit amount is exact.
 */
const rescaled = (discounts: readonly LineDiscount[], from: number, to: number): LineDiscount[] =>
  discounts.map((discount) => ({ ...discount, amount: (discount.amount / from) * to }));

/** `line` with `units` split off as a gift line at the outcome's gift price, never above the running unit price. */
function splitLine(line: RunningLine, units: number, input: GiftOutcomeInput): SplitLine {
  const giftPrice = Math.min(Math.max(input.outcome.unitPrices.get(line.key) ?? 0, 0), line.unitPrice);
  const gift: RunningLine = {
    ...line,
    key: giftLineKey(line.variantId, input.source.offerId),
    quantity: units,
    unitPrice: giftPrice,
    giftOf: input.source.offerId,
  };
  const paid = units === line.quantity ? null : { ...line, quantity: line.quantity - units };
  return { paid, gift, saving: (line.unitPrice - giftPrice) * units };
}

/** The discounts of a split line: the earlier ones shared by unit between both parts, the gift's own on the gift. */
function splitDiscounts(
  discounts: Map<string, readonly LineDiscount[]>,
  line: RunningLine,
  split: SplitLine,
  input: GiftOutcomeInput,
): void {
  const earlier = discounts.get(line.key) ?? [];
  const own = split.saving > 0 ? [{ ...input.source, amount: split.saving }] : [];
  discounts.set(split.gift.key, [...rescaled(earlier, line.quantity, split.gift.quantity), ...own]);
  if (split.paid === null) discounts.delete(line.key);
  else discounts.set(line.key, rescaled(earlier, line.quantity, split.paid.quantity));
}

/**
 * Splits the outcome's gifted units off their lines into gift lines (D2504): each gift line keeps the source line's
 * product, variant and original price, at the gift unit price; the paid part keeps its key and running price, and a
 * line whose every unit is gifted leaves the cart. Gift lines follow the other lines, so `totalPrice = unitPrice ×
 * quantity` holds on every line.
 */
export function applyGiftOutcome(input: GiftOutcomeInput): AppliedLineOutcome {
  const discounts = new Map(input.lineDiscounts);
  const paid: RunningLine[] = [];
  const gifts: RunningLine[] = [];
  let saving = 0;
  for (const line of input.lines) {
    const units = Math.min(input.outcome.gifts.get(line.key) ?? 0, line.quantity);
    if (units <= 0) {
      paid.push(line);
      continue;
    }
    const split = splitLine(line, units, input);
    splitDiscounts(discounts, line, split, input);
    if (split.paid !== null) paid.push(split.paid);
    gifts.push(split.gift);
    saving += split.saving;
  }
  return { lines: [...paid, ...gifts], lineDiscounts: discounts, saving };
}

/** What `applyAddonOutcome` reads. */
export interface AddonOutcomeInput {
  readonly lines: readonly RunningLine[];
  readonly lineDiscounts: LineDiscounts;
  readonly outcome: AddonOutcome;
  /** The offer the add-on saving is reported under. */
  readonly source: Omit<LineDiscount, 'amount'>;
}

/**
 * Appends the outcome's add-on lines after the cart's lines (D2506) and records each one's saving against its list
 * price as its line discount, so `savings` counts it like any line offer.
 */
export function applyAddonOutcome({ lines, lineDiscounts, outcome, source }: AddonOutcomeInput): AppliedLineOutcome {
  const discounts = new Map(lineDiscounts);
  let saving = 0;
  for (const line of outcome.lines) {
    const amount = (line.originalPrice - line.unitPrice) * line.quantity;
    if (amount > 0) discounts.set(line.key, [{ ...source, amount }]);
    saving += amount;
  }
  return { lines: [...lines, ...outcome.lines], lineDiscounts: discounts, saving };
}

/** The add-on fields of a quote line: its offer and the cart variant it rides with (D2506). */
const addonFieldsOf = ({ addonOf, parentVariantId = null }: RunningLine): Partial<QuoteLine> =>
  addonOf === undefined ? {} : { addonOf, parentVariantId };

/**
 * The quote lines: `totalPrice = unitPrice × quantity` always (D2409); a gift line names its offer (D2504), an add-on
 * line its offer and parent (D2506).
 */
export function quoteLinesOf(lines: readonly RunningLine[], lineDiscounts: LineDiscounts): QuoteLine[] {
  return lines.map((line) => ({
    key: line.key,
    productId: line.productId,
    variantId: line.variantId,
    quantity: line.quantity,
    originalPrice: line.originalPrice,
    unitPrice: line.unitPrice,
    totalPrice: line.unitPrice * line.quantity,
    discounts: [...(lineDiscounts.get(line.key) ?? [])],
    ...(line.giftOf === undefined ? {} : { giftOf: line.giftOf }),
    ...addonFieldsOf(line),
  }));
}

/**
 * The lines as the token signs them (ADR 0004 `l`): a gift line carries its offer as `g` (D2504); add-on lines are
 * signed in `a` only, never here, so an order counts each once (D2506).
 */
export function tokenLinesOf(lines: readonly QuoteLine[]): TokenLine[] {
  return lines
    .filter((line) => line.addonOf === undefined)
    .map((line) => ({
      variantId: line.variantId,
      qty: line.quantity,
      unitPrice: line.unitPrice,
      originalPrice: line.originalPrice,
      offerIds: line.discounts.map((discount) => discount.offerId),
      ...(line.giftOf === undefined ? {} : { g: line.giftOf }),
    }));
}

/** The add-on lines as the token signs them (ADR 0004 `a`, D2506): offer, variant, quantity, price and parent. */
export function tokenAddonsOf(lines: readonly QuoteLine[]): TokenAddon[] {
  return lines.flatMap(({ addonOf, variantId, quantity, unitPrice, parentVariantId = null }) =>
    addonOf === undefined ? [] : [{ offerId: addonOf, variantId, qty: quantity, unitPrice, parentVariantId }],
  );
}
