/** The storefront's own cache (ADR 0006): expires `'use cache'` entries by tag. */
export interface StorefrontRevalidatorPort {
  /**
   * Expires every entry tagged with one of `tags` (each a storefront cache tag).
   * @throws when the storefront did not confirm, so the caller's job retries
   */
  revalidate(tags: readonly string[]): Promise<void>;
}
