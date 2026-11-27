import { FeeCommuneRateEntity } from './fee-commune-rate.entity';
import { FeeGroupEntity } from './fee-group.entity';
import { FeeRateEntity } from './fee-rate.entity';

/** Every table of the plugin (migration `1795700000000-delivery-pricing`). */
export const DELIVERY_PRICING_ENTITIES = [FeeGroupEntity, FeeRateEntity, FeeCommuneRateEntity];
