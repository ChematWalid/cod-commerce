import { OfferCodeEntity } from './offer-code.entity';
import { OfferTargetEntity } from './offer-target.entity';
import { OfferEntity } from './offer.entity';

/** The offers' own tables (D2405), every one a `TenantEntity` reached only through `TenantRepository`. */
export const OFFERS_ENTITIES = [OfferEntity, OfferTargetEntity, OfferCodeEntity];
