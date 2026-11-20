import type { StoreScope } from '../../domain/store-scope';

/** An image's bytes and type. */
export interface ProductImage {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}

/**
 * Cleans a product image (background, watermark) (D2215). P2.S2 ships the identity adapter, gated by the `ai.enabled`
 * kill switch; P9.S7b plugs the AI one in and fetches stored image links through the same SSRF guard (D2214).
 */
export interface ImageCleanup {
  /** @throws AiDisabledError while the `ai.enabled` kill switch is off */
  cleanup(scope: StoreScope, image: ProductImage): Promise<ProductImage>;
}
