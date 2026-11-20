import { Logger } from '@vendure/core';
import type { PricingLogger } from '../domain/ports/pricing-logger.port';

/** The log context of the offers' operator reports. */
const OFFERS_LOG_CONTEXT = 'OffersPlugin';

/** {@link PricingLogger} on Vendure's `Logger` (D2404): ids and stored keys only, never buyer data. */
export const VENDURE_PRICING_LOGGER: PricingLogger = {
  unknownKind: (offerId, kind) => {
    Logger.warn(`Offer ${offerId} has unknown kind "${kind}"; it is left out of quotes`, OFFERS_LOG_CONTEXT);
  },
  unknownTarget: (offerId, refType, role) => {
    Logger.warn(
      `Offer ${offerId} has a target of unknown refType "${refType}" or role "${role}"; it is ignored`,
      OFFERS_LOG_CONTEXT,
    );
  },
  invalidConfig: (offerId, kind) => {
    Logger.warn(
      `Offer ${offerId} has a config its kind "${kind}" no longer accepts; it is left out of quotes`,
      OFFERS_LOG_CONTEXT,
    );
  },
};
