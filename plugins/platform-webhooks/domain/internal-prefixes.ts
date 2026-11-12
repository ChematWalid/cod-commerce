/**
 * The path prefixes only a signed internal caller may reach (D112): the Shop API, the storefront's store lookups
 * and the reserved `/_internal` tree. Express matches a mount per segment and without regard to case, so
 * `/stores/*` is not covered and `/STORE/resolve` is.
 */
export function internalOnlyPrefixes(shopApiPath: string): readonly string[] {
  return [`/${shopApiPath.replace(/^\/+/, '')}`, '/store', '/_internal'];
}
