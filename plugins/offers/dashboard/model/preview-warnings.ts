import type { OfferConfigWarning } from '@cod/shared';

/** The merchant's note per configuration warning (A11); a warning this dashboard does not know gets a generic one. */
const WARNING_MESSAGE_IDS: Readonly<Record<OfferConfigWarning, string>> = {
  tier_total_not_divisible: 'offers.warning-tier-total-not-divisible',
};
const OTHER_WARNING_MESSAGE_ID = 'offers.warning-other';

/** The catalogue id of a preview warning, shown by the preview and by the kind editor it concerns. */
export const warningMessageIdOf = (warning: string): string =>
  Object.hasOwn(WARNING_MESSAGE_IDS, warning)
    ? WARNING_MESSAGE_IDS[warning as OfferConfigWarning]
    : OTHER_WARNING_MESSAGE_ID;
