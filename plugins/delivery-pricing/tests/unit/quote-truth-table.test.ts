import { describe, expect, it } from 'vitest';
import type { CommuneRateRow, WilayaRateRow } from '../../domain/fee-group';
import { type DeliveryMethod, quoteDelivery, type QuoteTown } from '../../domain/quote';
import { commune, HOME_ONLY_TOWN, input, STOPDESK_TOWN, UNRESOLVED, WILAYA } from '../support/quote-fixtures';

/** One combination of the D3125 dimensions. */
interface TruthRow {
  readonly label: string;
  readonly communeRate: CommuneRateRow | null;
  readonly rate: WilayaRateRow;
  readonly town: QuoteTown | null;
  readonly method: DeliveryMethod;
  /** The commune's price of the method, written out from D3125 (`null`: it inherits). */
  readonly communePrice: number | null;
  /** The wilaya's price of the method, written out from D3125. */
  readonly wilayaPrice: number;
}

/** A method's price, written out from D3125. */
type MethodPrices = Readonly<Record<DeliveryMethod, number>>;

/** A price layer of the matrix: the row fields it sets and the price D3125 says it gives (`null`: it inherits). */
interface PriceCase<Fields, Expected extends MethodPrices | null> {
  readonly fields: Fields;
  readonly expected: Expected;
}

const COMMUNE_PRICES: Readonly<Record<string, PriceCase<Partial<CommuneRateRow> | null, MethodPrices | null>>> = {
  absent: { fields: null, expected: null },
  'price null': { fields: {}, expected: null },
  'base only': { fields: { baseHome: 700, baseDesk: 450 }, expected: { home: 700, desk: 450 } },
  override: {
    fields: { baseHome: 700, baseDesk: 450, overrideHome: 720, overrideDesk: 470 },
    expected: { home: 720, desk: 470 },
  },
};
/** The wilaya row's prices: its bases (600 / 400) alone, or overridden. */
const WILAYA_PRICES: Readonly<Record<string, PriceCase<Partial<WilayaRateRow>, MethodPrices>>> = {
  base: { fields: {}, expected: { home: 600, desk: 400 } },
  override: { fields: { overrideHome: 650, overrideDesk: 380 }, expected: { home: 650, desk: 380 } },
};
const SWITCHES = [null, true, false] as const;
const TOWNS: Readonly<Record<string, QuoteTown | null>> = {
  none: null,
  stopdesk: STOPDESK_TOWN,
  'home only': HOME_ONLY_TOWN,
};
const METHODS: readonly DeliveryMethod[] = ['home', 'desk'];

/** The commune row of a combination: none when it sets neither a price nor a switch. */
function communeRowOf(
  prices: Partial<CommuneRateRow> | null,
  deliveryEnabled: boolean | null,
  deskEnabled: boolean | null,
): CommuneRateRow | null {
  if (prices === null && deliveryEnabled === null && deskEnabled === null) return null;
  return commune({ ...(prices ?? {}), deliveryEnabled, deskEnabled });
}

/** Every combination: commune prices × commune switches × wilaya prices × wilaya switches × town × method. */
function allRows(): TruthRow[] {
  return Object.entries(COMMUNE_PRICES).flatMap(([priceLabel, communePrices]) =>
    SWITCHES.flatMap((delivery) =>
      SWITCHES.flatMap((desk) =>
        Object.entries(WILAYA_PRICES).flatMap(([wilayaLabel, wilayaPrices]) =>
          [true, false].flatMap((wilayaDelivery) =>
            [true, false].flatMap((wilayaDesk) =>
              Object.entries(TOWNS).flatMap(([townLabel, town]) =>
                METHODS.map((method) => ({
                  label: [
                    method,
                    `commune ${priceLabel} delivery=${String(delivery)} desk=${String(desk)}`,
                    `wilaya ${wilayaLabel} delivery=${String(wilayaDelivery)} desk=${String(wilayaDesk)}`,
                    `town ${townLabel}`,
                  ].join(', '),
                  communeRate: communeRowOf(communePrices.fields, delivery, desk),
                  rate: { ...WILAYA, ...wilayaPrices.fields, deliveryEnabled: wilayaDelivery, deskEnabled: wilayaDesk },
                  town,
                  method,
                  communePrice: communePrices.expected?.[method] ?? null,
                  wilayaPrice: wilayaPrices.expected[method],
                })),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/** D3125, read row by row: home = delivery; desk = delivery && desk switch && (no town or a stop-desk town). */
function isOffered({ communeRate, rate, town, method }: TruthRow): boolean {
  const delivers = communeRate?.deliveryEnabled ?? rate.deliveryEnabled;
  if (method === 'home') return delivers;
  const deskOn = communeRate?.deskEnabled ?? rate.deskEnabled;
  return delivers && deskOn && (town === null || town.isStopdesk);
}

/**
 * Every combination of the D3125 dimensions, checked against the truth table read row by row: price = commune
 * `override ?? base` (source commune), else wilaya `override ?? base` (source wilaya); delivery = commune switch ??
 * wilaya switch; desk = delivery && (commune desk ?? wilaya desk) && (no town or the town's stop desk); home = delivery.
 */
describe('quoteDelivery: the whole D3125 truth table', () => {
  it.each(allRows())('$label', (row) => {
    // Arrange
    const { communePrice, wilayaPrice } = row;
    const expected = isOffered(row)
      ? { resolved: true, baseFee: communePrice ?? wilayaPrice, source: communePrice === null ? 'wilaya' : 'commune' }
      : UNRESOLVED;

    // Act
    const quote = quoteDelivery(
      input({ communeRate: row.communeRate, rate: row.rate, town: row.town, method: row.method }),
    );

    // Assert
    expect(quote).toMatchObject(expected);
  });
});
