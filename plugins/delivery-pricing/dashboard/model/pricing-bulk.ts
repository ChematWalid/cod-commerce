import type { PricingForm, PricingRow } from './pricing-form';

/** The prices typed in the "Apply to all" row; a blank one leaves that price of every row as it is. */
export interface ApplyToAll {
  readonly home: string;
  readonly desk: string;
}

const mapRows = (form: PricingForm, change: (row: PricingRow) => PricingRow): PricingForm => ({
  ...form,
  rows: form.rows.map(change),
});

/** "Apply to all": every row takes the typed home and desk prices. */
export function withApplyToAll(form: PricingForm, prices: ApplyToAll): PricingForm {
  const home = prices.home.trim();
  const desk = prices.desk.trim();
  return mapRows(form, (row) => ({
    ...row,
    homePrice: home === '' ? row.homePrice : home,
    deskPrice: desk === '' ? row.deskPrice : desk,
  }));
}

/** "Deliver to every wilaya": on when every row delivers. */
export const deliversEverywhere = (form: PricingForm): boolean => form.rows.every((row) => row.deliveryEnabled);

/** Switches delivery on or off in every wilaya. */
export function withDeliverEverywhere(form: PricingForm, on: boolean): PricingForm {
  return mapRows(form, (row) => ({ ...row, deliveryEnabled: on }));
}

/** "Stop desk in every delivered wilaya": on when some wilaya delivers and every delivered one has its desk on. */
export function deskEverywhere(form: PricingForm): boolean {
  const delivered = form.rows.filter((row) => row.deliveryEnabled);
  return delivered.length > 0 && delivered.every((row) => row.deskEnabled);
}

/**
 * On, the desk opens in every delivered wilaya (a wilaya without delivery keeps its switch: its desk is not offered
 * anyway, D3120); off, every desk closes.
 */
export function withDeskEverywhere(form: PricingForm, on: boolean): PricingForm {
  return mapRows(form, (row) => ({ ...row, deskEnabled: on ? row.deskEnabled || row.deliveryEnabled : false }));
}
