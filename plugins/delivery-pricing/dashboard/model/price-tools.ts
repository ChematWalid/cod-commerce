import {
  type DeliveryFeeCommunePricesInput,
  deliveryFeeCommunePricesInputSchema,
  type DeliveryFeePriceAdjustmentInput,
  deliveryFeePriceAdjustmentInputSchema,
  FEE_GROUP_NAME_MAX,
  type PriceAdjustmentKind,
  type WilayaCode,
} from '@cod/shared';
import type { PricingForm } from './pricing-form';

/** Whether the "Raise/lower by…" dialog raises or lowers: the typed value carries no sign. */
export type AdjustDirection = 'raise' | 'lower';

/** The "Raise/lower by…" dialog as typed (D3140); the value stays text until it is sent. */
export interface AdjustForm {
  readonly direction: AdjustDirection;
  readonly kind: PriceAdjustmentKind;
  readonly value: string;
  readonly home: boolean;
  readonly desk: boolean;
  readonly includeCommunes: boolean;
}

/** The dialog when it opens: a DZD raise of the home price, commune overrides left as they are. */
export const INITIAL_ADJUST_FORM: AdjustForm = {
  direction: 'raise',
  kind: 'amount',
  value: '',
  home: true,
  desk: false,
  includeCommunes: false,
};

/** A typed input the shared contract accepts, or a refusal (no request is sent then). */
export type ToolInput<T> = { readonly ok: true; readonly input: T } | { readonly ok: false };

const UNSIGNED_WHOLE = /^\d+$/;

/** The whole number a field holds without a sign, or NaN. */
function unsignedOf(text: string): number {
  const trimmed = text.trim();
  return UNSIGNED_WHOLE.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** The `adjustDeliveryFeeGroupPrices` input of the dialog for the selected wilayas, checked by the shared contract. */
export function adjustmentInputOf(
  form: AdjustForm,
  selection: ReadonlySet<WilayaCode>,
): ToolInput<DeliveryFeePriceAdjustmentInput> {
  const magnitude = unsignedOf(form.value);
  const parsed = deliveryFeePriceAdjustmentInputSchema.safeParse({
    provinceCodes: [...selection],
    kind: form.kind,
    value: form.direction === 'lower' ? -magnitude : magnitude,
    home: form.home,
    desk: form.desk,
    includeCommunes: form.includeCommunes,
  });
  return parsed.success ? { ok: true, input: parsed.data } : { ok: false };
}

/** Whether no, some or every wilaya row of the table is ticked. */
export type SelectionState = 'none' | 'some' | 'all';

/** `selection` with `code` ticked or unticked. */
export function withSelected(
  selection: ReadonlySet<WilayaCode>,
  code: WilayaCode,
  on: boolean,
): ReadonlySet<WilayaCode> {
  const next = new Set(selection);
  if (on) next.add(code);
  else next.delete(code);
  return next;
}

/** Every row of the table ticked, or none. */
export const withAllSelected = (codes: readonly WilayaCode[], on: boolean): ReadonlySet<WilayaCode> =>
  new Set(on ? codes : []);

/** How much of the table `selection` ticks. */
export function selectionStateOf(selection: ReadonlySet<WilayaCode>, codes: readonly WilayaCode[]): SelectionState {
  const ticked = codes.filter((code) => selection.has(code)).length;
  if (ticked === 0) return 'none';
  return ticked === codes.length ? 'all' : 'some';
}

/** The "Set price for all communes" fields as typed; a blank one leaves that price of every commune as it is. */
export interface CommunePricesForm {
  readonly home: string;
  readonly desk: string;
}

/** A typed price, or absent when blank. */
const typedPrice = (text: string): number | undefined => (text.trim() === '' ? undefined : unsignedOf(text));

/** The `setDeliveryFeeProvinceCommunePrices` input of the fields, checked by the shared contract. */
export function communePricesInputOf(
  provinceCode: WilayaCode,
  form: CommunePricesForm,
): ToolInput<DeliveryFeeCommunePricesInput> {
  const homePrice = typedPrice(form.home);
  const deskPrice = typedPrice(form.desk);
  const prices = {
    ...(homePrice === undefined ? {} : { homePrice }),
    ...(deskPrice === undefined ? {} : { deskPrice }),
  };
  const parsed = deliveryFeeCommunePricesInputSchema.safeParse({ provinceCode, prices });
  return parsed.success ? { ok: true, input: parsed.data } : { ok: false };
}

/**
 * The name a copy starts with: the translated pattern around the source's name, cut to the contract's length
 * (`FEE_GROUP_NAME_MAX`, UTF-16 units) between two characters, never inside one.
 */
export function copyNameOf(source: string, pattern: (name: string) => string): string {
  let name = '';
  for (const character of pattern(source)) {
    if (name.length + character.length > FEE_GROUP_NAME_MAX) break;
    name += character;
  }
  return name;
}

/** Whether two states of the editor hold the same values (the form is plain data, so its JSON says it all). */
export const sameForm = (left: PricingForm, right: PricingForm): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
