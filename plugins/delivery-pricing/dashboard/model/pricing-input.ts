import { type DeliveryFeeGroupInput, deliveryFeeGroupInputSchema } from '@cod/shared';
import { type PricingForm, priceOf } from './pricing-form';

/** A refused field: the name, an overweight setting, or the prices of one wilaya (`rate:<code>`). */
export type PricingField = string;

/** The save's input, or the fields the shared contract refuses (no request is sent then). */
export type PricingSubmit =
  | { readonly ok: true; readonly input: DeliveryFeeGroupInput }
  | { readonly ok: false; readonly errors: ReadonlySet<PricingField> };

/** The field a refused path names: the top-level field, or `rate:<code>` for anything inside one rate. */
function fieldOf(path: readonly PropertyKey[], form: PricingForm): PricingField {
  const [head, index] = path;
  if (head !== 'rates') return String(head ?? 'form');
  const row = typeof index === 'number' ? form.rows[index] : undefined;
  return row === undefined ? 'rates' : `rate:${row.provinceCode}`;
}

/**
 * The `DeliveryFeeGroupInput` of the form, checked by the shared contract the API parses with
 * (`deliveryFeeGroupInputSchema`), so the editor names a refused field without a request; the server checks again.
 */
export function pricingInputOf(form: PricingForm): PricingSubmit {
  const parsed = deliveryFeeGroupInputSchema.safeParse({
    name: form.name,
    carrierId: form.carrierId,
    chargeOverweight: form.chargeOverweight,
    overweightAllowanceKg: priceOf(form.overweightAllowanceKg),
    overweightRate: priceOf(form.overweightRate),
    rates: form.rows.map((row) => ({
      provinceCode: row.provinceCode,
      homePrice: priceOf(row.homePrice),
      deskPrice: priceOf(row.deskPrice),
      deliveryEnabled: row.deliveryEnabled,
      deskEnabled: row.deskEnabled,
    })),
  });
  if (parsed.success) return { ok: true, input: parsed.data };
  return { ok: false, errors: new Set(parsed.error.issues.map((issue) => fieldOf(issue.path, form))) };
}
