import type { BusinessId, Snowflake, StoreId } from '@cod/shared';
import type { CoreId } from './core-id';
import type { QuantityRulesInput } from './quantity-rules';

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
