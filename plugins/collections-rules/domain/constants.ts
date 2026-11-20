/** Every member of an automatic collection sits at this position; the list orders them newest product first (D2318). */
export const AUTOMATIC_MEMBER_POSITION = 0;

/** The position of the first product of a manual collection; the next ones follow at +1 (D2318). */
export const FIRST_MANUAL_POSITION = 0;

/** The smallest core id (product, collection) Vendure issues: its int ids start at 1, so 0 names nothing. */
export const MIN_CORE_ID = 1;

/** Products read per keyset page when a rule is matched over a whole store: the facts reader's batch (D2308, D2312). */
export const STORE_WALK_PAGE_SIZE = 100;
