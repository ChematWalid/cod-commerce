import type { AiSwitchPort } from '../application/ports/ai-switch.port';
import type { ImageCleanup, ProductImage } from '../application/ports/image-cleanup.port';
import { AiDisabledError } from '../domain/errors';
import type { StoreScope } from '../domain/store-scope';

/** The image clean-up of P2.S2 (D2215): behind the `ai.enabled` switch, the image comes back as it was given. */
export class IdentityImageCleanup implements ImageCleanup {
  constructor(private readonly ai: AiSwitchPort) {}

  async cleanup(scope: StoreScope, image: ProductImage): Promise<ProductImage> {
    if (!(await this.ai.isEnabled(scope))) throw new AiDisabledError();
    return image;
  }
}
