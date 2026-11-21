import { bxgyConfigSchema, type BxgyConfig, type QuoteLine } from '@cod/shared';
import type { Offer } from '../../domain/offer';
import { anOffer } from './builders';

/** The id of the buy-x-get-y offer of these tests. */
export const BXGY_ID = '7005';

/** A buy-2-get-1-free config of the same matched items without a cap, changed by `raw`, parsed like a stored one. */
export const aBxgyConfig = (raw: Record<string, unknown> = {}): BxgyConfig =>
  bxgyConfigSchema.parse({
    appliesTo: 'targets',
    buyQuantity: 2,
    getQuantity: 1,
    getFrom: 'same',
    gift: { mode: 'free' },
    maxTimesPerOrder: null,
    ...raw,
  });

/** A buy-x-get-y offer {@link BXGY_ID} buying product 1, with {@link aBxgyConfig} of `raw`. */
export const aBxgyOffer = (raw: Record<string, unknown> = {}, overrides: Partial<Offer> = {}): Offer =>
  anOffer({
    id: BXGY_ID,
    kind: 'bxgy',
    config: aBxgyConfig(raw),
    targets: [{ role: 'buy', refType: 'product', refId: '1' }],
    ...overrides,
  });

/** Buy product 1, get product 2: the targets of a gift taken from another product. */
export const BUY_P1_GET_P2: Offer['targets'] = [
  { role: 'buy', refType: 'product', refId: '1' },
  { role: 'get', refType: 'product', refId: '2' },
];

/** The quote line of `key`, failing the test when the quote has none. */
export function lineOf(lines: readonly QuoteLine[], key: string): QuoteLine {
  const line = lines.find((candidate) => candidate.key === key);
  if (line === undefined) throw new Error(`no quote line ${key} in ${lines.map((each) => each.key).join(', ')}`);
  return line;
}

/** Each line's key, quantity and unit price, in quote order. */
export const shapeOf = (lines: readonly QuoteLine[]) =>
  lines.map(({ key, quantity, unitPrice }) => ({ key, quantity, unitPrice }));
