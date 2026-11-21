import type { OfferAppGoal, OfferAppType, OfferMethod } from '@cod/shared';

/** The label and one-line description of a create dialog card, by catalogue id. */
interface AppTypeLabels {
  readonly labelId: string;
  readonly hintId: string;
}

/** The built-in cards' texts by app-type id (D2515); a card registered by an app (P9.S8b) gets the generic text. */
const APP_TYPE_LABELS: Readonly<Record<string, AppTypeLabels>> = {
  quantity: { labelId: 'offers.app-quantity', hintId: 'offers.app-quantity-hint' },
  free_delivery: { labelId: 'offers.app-free-delivery', hintId: 'offers.app-free-delivery-hint' },
  product_discount: { labelId: 'offers.app-product-discount', hintId: 'offers.app-product-discount-hint' },
  discount_codes: { labelId: 'offers.app-discount-codes', hintId: 'offers.app-discount-codes-hint' },
  bxgy: { labelId: 'offers.app-bxgy', hintId: 'offers.app-bxgy-hint' },
  order_discount: { labelId: 'offers.app-order-discount', hintId: 'offers.app-order-discount-hint' },
  addon: { labelId: 'offers.app-addon', hintId: 'offers.app-addon-hint' },
};

export const OTHER_APP_TYPE_LABELS: AppTypeLabels = { labelId: 'offers.app-other', hintId: 'offers.app-other-hint' };

const GOAL_LABEL_IDS: Readonly<Record<OfferAppGoal, string>> = {
  sell_more: 'offers.goal-sell-more',
  delivery: 'offers.goal-delivery',
  stock: 'offers.goal-stock',
  influencers: 'offers.goal-influencers',
};

/** The kinds' names, for the list's kind column and chips; an app's own kind gets the generic name. */
const KIND_LABEL_IDS: Readonly<Record<string, string>> = {
  quantity: 'offers.kind-quantity',
  free_delivery: 'offers.kind-free-delivery',
  product_discount: 'offers.kind-product-discount',
  bxgy: 'offers.kind-bxgy',
  order_discount: 'offers.kind-order-discount',
  addon: 'offers.kind-addon',
};

const OTHER_KIND_LABEL_ID = 'offers.kind-other';

/** The catalogue id of a kind's name. */
export const kindLabelIdOf = (kind: string): string => KIND_LABEL_IDS[kind] ?? OTHER_KIND_LABEL_ID;

/** A card of the create dialog: the app type it opens the editor for, and the texts it shows. */
export interface AppTypeCard extends AppTypeLabels {
  readonly id: string;
  readonly kind: string;
  readonly method: OfferMethod;
  readonly recommended: boolean;
  /** The goal's catalogue id, `null` for a card shown under "all kinds" only. */
  readonly goalLabelId: string | null;
}

function cardOf(type: OfferAppType): AppTypeCard {
  return {
    id: type.id,
    kind: type.kind,
    method: type.method,
    recommended: type.recommended,
    goalLabelId: type.goal === null ? null : GOAL_LABEL_IDS[type.goal],
    ...(APP_TYPE_LABELS[type.id] ?? OTHER_APP_TYPE_LABELS),
  };
}

/** The first card of each goal, in catalogue order. */
function firstPerGoal(types: readonly OfferAppType[]): readonly OfferAppType[] {
  const seen = new Set<OfferAppGoal>();
  return types.filter((type) => {
    if (type.goal === null || seen.has(type.goal)) return false;
    seen.add(type.goal);
    return true;
  });
}

/**
 * The create dialog's two views (D2523): "by goal" holds one card per goal, the recommended one first, the others in
 * catalogue order; "all kinds" holds every card in catalogue order, as `offerAppTypes` answers them.
 */
export function appTypeCards(types: readonly OfferAppType[]): {
  readonly byGoal: readonly AppTypeCard[];
  readonly all: readonly AppTypeCard[];
} {
  const goals = firstPerGoal(types);
  const byGoal = [...goals.filter((type) => type.recommended), ...goals.filter((type) => !type.recommended)];
  return { byGoal: byGoal.map(cardOf), all: types.map(cardOf) };
}

/** A chip of the list's kind filter. */
export interface KindChip {
  readonly kind: string;
  readonly labelId: string;
}

/** One chip per kind the app types name, in catalogue order (two cards may share a kind, D2403). */
export function kindChipsOf(types: readonly OfferAppType[]): readonly KindChip[] {
  const kinds = [...new Set(types.map((type) => type.kind))];
  return kinds.map((kind) => ({ kind, labelId: kindLabelIdOf(kind) }));
}
