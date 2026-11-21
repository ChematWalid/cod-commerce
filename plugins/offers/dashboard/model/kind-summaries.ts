import type {
  AddonConfig,
  AddonPrice,
  BxgyConfig,
  BxgyGift,
  DiscountValueType,
  ProductDiscountConfig,
  QuantityConfig,
  QuantityPriceMode,
  QuantityTier,
  Threshold,
} from '@cod/shared';
import {
  DEFAULT_ADDON_CONFIG,
  DEFAULT_BXGY_CONFIG,
  DEFAULT_FREE_DELIVERY_CONFIG,
  DEFAULT_ORDER_DISCOUNT_CONFIG,
  DEFAULT_PRODUCT_DISCOUNT_CONFIG,
  DEFAULT_QUANTITY_CONFIG,
} from './default-configs';
import type { OfferEditorForm } from './editor-form';
import { readConfig } from './kind-editors';
import { targetsOfRole } from './target-list';

/** One sentence of the summary card: a catalogue id and the values of its slots (D2523; no pricing math). */
export interface SummaryLine {
  readonly id: string;
  readonly values?: Readonly<Record<string, string | number>>;
}

type KindSummary = (form: OfferEditorForm) => SummaryLine[];

const line = (id: string, values?: Readonly<Record<string, string | number>>): SummaryLine =>
  values === undefined ? { id } : { id, values };

const TIER_PRICE_IDS: Readonly<Record<QuantityPriceMode, string>> = {
  percent: 'offers.summary-tier-percent',
  total: 'offers.summary-tier-total',
};

function tierLines(tier: QuantityTier, priceMode: QuantityPriceMode): SummaryLine[] {
  const quantity = { quantity: tier.quantity };
  return [
    line(TIER_PRICE_IDS[priceMode], { ...quantity, price: tier.price }),
    ...(tier.freeDelivery ? [line('offers.summary-tier-free-delivery', quantity)] : []),
  ];
}

/** How many targets of `role` the offer holds, or that it holds none yet. */
function targetsLine(form: OfferEditorForm, role: 'buy' | 'addon', idOf: { some: string; none: string }): SummaryLine {
  const count = targetsOfRole(form.targets, role).length;
  return count === 0 ? line(idOf.none) : line(idOf.some, { count });
}

const BUY_TARGET_IDS = { some: 'offers.summary-targets', none: 'offers.summary-targets-none' };
const ADDON_TARGET_IDS = { some: 'offers.summary-addon-products', none: 'offers.summary-addon-products-none' };

function quantitySummary(form: OfferEditorForm): SummaryLine[] {
  const config = readConfig<QuantityConfig>(form.config, DEFAULT_QUANTITY_CONFIG);
  const picked = config.tiers.find((tier) => tier.preselected);
  return [
    ...config.tiers.flatMap((tier) => tierLines(tier, config.priceMode)),
    ...(picked === undefined ? [] : [line('offers.summary-tier-preselected', { quantity: picked.quantity })]),
    targetsLine(form, 'buy', BUY_TARGET_IDS),
  ];
}

const FREE_DELIVERY_IDS: Readonly<Record<Threshold['type'], string>> = {
  none: 'offers.summary-free-delivery-none',
  pieces: 'offers.summary-free-delivery-pieces',
  amount: 'offers.summary-free-delivery-amount',
};

const thresholdValues = (threshold: Threshold) => ('min' in threshold ? { min: threshold.min } : undefined);

function freeDeliverySummary(form: OfferEditorForm): SummaryLine[] {
  const { threshold } = readConfig(form.config, DEFAULT_FREE_DELIVERY_CONFIG);
  return [line(FREE_DELIVERY_IDS[threshold.type], thresholdValues(threshold))];
}

const DISCOUNT_IDS: Readonly<Record<DiscountValueType, string>> = {
  percent: 'offers.summary-discount-percent',
  fixed: 'offers.summary-discount-fixed',
};

function productDiscountSummary(form: OfferEditorForm): SummaryLine[] {
  const config = readConfig<ProductDiscountConfig>(form.config, DEFAULT_PRODUCT_DISCOUNT_CONFIG);
  return [
    line(DISCOUNT_IDS[config.valueType], { value: config.value }),
    ...(config.cap === null ? [] : [line('offers.summary-discount-cap', { cap: config.cap })]),
    config.appliesTo === 'all' ? line('offers.summary-scope-all') : targetsLine(form, 'buy', BUY_TARGET_IDS),
    ...(config.showCountdown ? [line('offers.summary-countdown')] : []),
  ];
}

const GIFT_IDS: Readonly<Record<BxgyGift['mode'], string>> = {
  free: 'offers.summary-gift-free',
  percent: 'offers.summary-gift-percent',
  fixed: 'offers.summary-gift-fixed',
};
const BXGY_SOURCE_IDS: Readonly<Record<BxgyConfig['getFrom'], string>> = {
  same: 'offers.summary-bxgy-same',
  targets: 'offers.summary-bxgy-targets',
};

const giftValues = (gift: BxgyGift) => ('value' in gift ? { value: gift.value } : undefined);

function bxgySummary(form: OfferEditorForm): SummaryLine[] {
  const config = readConfig<BxgyConfig>(form.config, DEFAULT_BXGY_CONFIG);
  const times = config.maxTimesPerOrder;
  return [
    line(BXGY_SOURCE_IDS[config.getFrom], { buy: config.buyQuantity, get: config.getQuantity }),
    line(GIFT_IDS[config.gift.mode], giftValues(config.gift)),
    ...(times === null ? [] : [line('offers.summary-bxgy-times', { count: times })]),
    config.appliesTo === 'all' ? line('offers.summary-scope-all') : targetsLine(form, 'buy', BUY_TARGET_IDS),
  ];
}

const ORDER_DISCOUNT_IDS: Readonly<Record<DiscountValueType, string>> = {
  percent: 'offers.summary-order-percent',
  fixed: 'offers.summary-order-fixed',
};
const MINIMUM_IDS: Readonly<Record<Threshold['type'], string | null>> = {
  none: null,
  pieces: 'offers.summary-minimum-pieces',
  amount: 'offers.summary-minimum-amount',
};

function orderDiscountSummary(form: OfferEditorForm): SummaryLine[] {
  const config = readConfig(form.config, DEFAULT_ORDER_DISCOUNT_CONFIG);
  const minimumId = MINIMUM_IDS[config.minimum.type];
  return [
    line(ORDER_DISCOUNT_IDS[config.valueType], { value: config.value }),
    ...(config.cap === null ? [] : [line('offers.summary-order-cap', { cap: config.cap })]),
    ...(minimumId === null ? [] : [line(minimumId, thresholdValues(config.minimum))]),
  ];
}

const ADDON_PRICE_IDS: Readonly<Record<AddonPrice['mode'], string>> = {
  fixed: 'offers.summary-addon-fixed',
  percent: 'offers.summary-addon-percent',
  amount_off: 'offers.summary-addon-amount-off',
};
const ADDON_CONDITION_IDS: Readonly<Record<AddonConfig['condition'], string>> = {
  any_order: 'offers.summary-addon-any-order',
  targets: 'offers.summary-addon-with-targets',
};
const ADDON_PLACEMENT_IDS: Readonly<Record<AddonConfig['placement'], string>> = {
  order_form: 'offers.summary-addon-order-form',
  thank_you: 'offers.summary-addon-thank-you',
};

function addonSummary(form: OfferEditorForm): SummaryLine[] {
  const config = readConfig<AddonConfig>(form.config, DEFAULT_ADDON_CONFIG);
  return [
    targetsLine(form, 'addon', ADDON_TARGET_IDS),
    line(ADDON_PRICE_IDS[config.price.mode], { value: config.price.value }),
    line(ADDON_CONDITION_IDS[config.condition]),
    line('offers.summary-addon-pieces', { count: config.maxPiecesPerOrder }),
    line(ADDON_PLACEMENT_IDS[config.placement]),
  ];
}

/** The kind's own sentences by app-type id, a map like the editors (§3a.7). */
const KIND_SUMMARIES: Readonly<Partial<Record<string, KindSummary>>> = {
  quantity: quantitySummary,
  free_delivery: freeDeliverySummary,
  product_discount: productDiscountSummary,
  discount_codes: productDiscountSummary,
  bxgy: bxgySummary,
  order_discount: orderDiscountSummary,
  addon: addonSummary,
};

/** The sentences of the form's kind; a card the dashboard does not know gets one generic sentence. */
export const kindSummaryOf = (form: OfferEditorForm): SummaryLine[] =>
  KIND_SUMMARIES[form.appTypeId]?.(form) ?? [line('offers.summary-kind-other')];

export { line as summaryLine };
