/**
 * An option name or value as packs match them (D2202): catalog's shared name rule (trimmed, NFC, lower case, so
 * `Size ` is `size`), re-exported so packs and catalog can never drift apart.
 */
export { catalogNameKey as optionKey } from '@cod/shared';
