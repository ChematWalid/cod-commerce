import type { BusinessId, Snowflake, StoreId } from '@cod/shared';
import { MIN_ORDER_QUANTITY } from './constants';
import type { CoreId } from './core-id';
import { QuantityRules, type QuantityRulesInput } from './quantity-rules';
import type { StoreScope } from './store-scope';

/** A name and value the merchant shows on a product, such as Material: Leather. */
export interface CustomAttribute {
  readonly name: string;
  readonly value: string;
}

/** The merchant-only settings of one product in its store (brief AC5, D2107, D2108). */
export interface ProductSettings {
  readonly id: Snowflake;
  readonly businessId: BusinessId;
  readonly storeId: StoreId;
  readonly productId: CoreId;
  /** The product's name on the delivery label, when it differs from its title. */
  readonly nameInDelivery: string | null;
  readonly isFragile: boolean;
  readonly allowParcelOpening: boolean;
  /** Orders stay open while the product is sold out; "stop orders" turns it off (D2108). */
  readonly allowOutOfStockOrders: boolean;
  /** The manual sold-out flag the default sold-out source reads until stock exists (D2107). */
  readonly soldOut: boolean;
  readonly quantityRules: QuantityRulesInput;
  /** Team-member ids, never administrator ids (D2114). */
  readonly orderManagerIds: readonly Snowflake[];
  readonly customAttributes: readonly CustomAttribute[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** The settings fields a merchant edits, as validated at the boundary. */
export type ProductSettingsValues = Omit<
  ProductSettings,
  'id' | 'businessId' | 'storeId' | 'productId' | 'createdAt' | 'updatedAt'
>;

/** A change to settings: an absent key stays, `quantityRules` may change in part, a sent list replaces. */
export type ProductSettingsChange = Partial<Omit<ProductSettingsValues, 'quantityRules'>> & {
  readonly quantityRules?: Partial<QuantityRulesInput>;
};

/** What a product's settings are before the merchant saves any: nothing special, orders open (D2108). */
export const DEFAULT_PRODUCT_SETTINGS: ProductSettingsValues = {
  nameInDelivery: null,
  isFragile: false,
  allowParcelOpening: false,
  allowOutOfStockOrders: true,
  soldOut: false,
  quantityRules: { enabled: false, min: MIN_ORDER_QUANTITY, step: MIN_ORDER_QUANTITY },
  orderManagerIds: [],
  customAttributes: [],
};

/** The identity of one product's settings row: its id, business, store, product and the time of the save. */
export interface SettingsIdentity {
  readonly id: Snowflake;
  readonly scope: StoreScope;
  readonly productId: CoreId;
  readonly now: Date;
}

/**
 * The settings of a product after `change`, on top of `current` (or of {@link DEFAULT_PRODUCT_SETTINGS} when none was
 * saved). The quantity rules are checked whole.
 *
 * @throws {InvalidCatalogInputError} when the resulting quantity rules are out of bounds.
 */
export function settingsAfter(
  current: ProductSettings | undefined,
  change: ProductSettingsChange,
  identity: SettingsIdentity,
): ProductSettings {
  const base = current ?? DEFAULT_PRODUCT_SETTINGS;
  const { quantityRules: rulesChange, ...rest } = change;
  const quantityRules = QuantityRules.create({ ...base.quantityRules, ...withoutUndefined(rulesChange ?? {}) });
  return {
    ...DEFAULT_PRODUCT_SETTINGS,
    ...settingsValuesOf(base),
    ...withoutUndefined(rest),
    quantityRules: { enabled: quantityRules.enabled, min: quantityRules.min, step: quantityRules.step },
    id: current?.id ?? identity.id,
    businessId: identity.scope.businessId,
    storeId: identity.scope.storeId,
    productId: identity.productId,
    createdAt: current?.createdAt ?? identity.now,
    updatedAt: identity.now,
  };
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as Partial<T>;
}

/** The merchant-edited fields of `settings`, without the row's identity. */
export function settingsValuesOf(settings: ProductSettingsValues): ProductSettingsValues {
  const { nameInDelivery, isFragile, allowParcelOpening, allowOutOfStockOrders, soldOut } = settings;
  const { quantityRules, orderManagerIds, customAttributes } = settings;
  return {
    nameInDelivery,
    isFragile,
    allowParcelOpening,
    allowOutOfStockOrders,
    soldOut,
    quantityRules,
    orderManagerIds,
    customAttributes,
  };
}
