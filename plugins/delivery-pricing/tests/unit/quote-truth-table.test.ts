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
}

const COMMUNE_PRICES: Readonly<Record<string, Partial<CommuneRateRow> | null>> = {
  absent: null,
  'price null': {},
  'base only': { baseHome: 700, baseDesk: 450 },
  override: { baseHome: 700, baseDesk: 450, overrideHome: 720, overrideDesk: 470 },
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

/** Every combination: commune prices × commune switches × wilaya switches × town × method. */
function allRows(): TruthRow[] {
  return Object.entries(COMMUNE_PRICES).flatMap(([priceLabel, prices]) =>
    SWITCHES.flatMap((delivery) =>
      SWITCHES.flatMap((desk) =>
        [true, false].flatMap((wilayaDelivery) =>
          [true, false].flatMap((wilayaDesk) =>
            Object.entries(TOWNS).flatMap(([townLabel, town]) =>
              METHODS.map((method) => ({
                label: [
                  method,
                  `commune ${priceLabel} delivery=${String(delivery)} desk=${String(desk)}`,
                  `wilaya delivery=${String(wilayaDelivery)} desk=${String(wilayaDesk)}`,
                  `town ${townLabel}`,
                ].join(', '),
                communeRate: communeRowOf(prices, delivery, desk),
                rate: { ...WILAYA, deliveryEnabled: wilayaDelivery, deskEnabled: wilayaDesk },
                town,
                method,
              })),
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

/** D3125: commune `override ?? base` of the method, `null` when the commune sets no price for it. */
function communePriceOf({ communeRate, method }: TruthRow): number | null {
  if (communeRate === null) return null;
  return method === 'home'
    ? (communeRate.overrideHome ?? communeRate.baseHome)
    : (communeRate.overrideDesk ?? communeRate.baseDesk);
}

/**
 * Every combination of the D3125 dimensions, checked against the truth table read row by row: price = commune
 * `override ?? base` (source commune), else wilaya `override ?? base` (source wilaya); delivery = commune switch ??
 * wilaya switch; desk = delivery && (commune desk ?? wilaya desk) && (no town or the town's stop desk); home = delivery.
 */
describe('quoteDelivery: the whole D3125 truth table', () => {
  it.each(allRows())('$label', (row) => {
    // Arrange
    const communePrice = communePriceOf(row);
    const wilayaPrice = row.method === 'home' ? row.rate.baseHome : row.rate.baseDesk;
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
