import { AiDisabledError, ProductNotFoundError } from '../domain/errors';
import type { StoreScope } from '../domain/store-scope';
import type { AiSwitchPort } from './ports/ai-switch.port';
import type { OperationContext } from './ports/operation-context';
import type { ProductPolisher, ProductText, ProductTextReads } from './ports/product-polisher.port';

/** A product's polished text (`CatalogProductPolish`); nothing is saved, the merchant decides. */
export interface PolishedProductView extends ProductText {
  readonly productId: string;
}

/** What {@link PolishProductService} runs through. */
export interface PolishProductDeps {
  readonly ai: AiSwitchPort;
  readonly products: ProductTextReads;
  readonly polisher: ProductPolisher;
}

/**
 * "Polish a product's text" (D2215): the hook P9.S7b fills with AI. Behind the `ai.enabled` kill switch; the product
 * must be the store's own. P2.S2's polisher answers the text unchanged.
 */
export class PolishProductService {
  constructor(private readonly deps: PolishProductDeps) {}

  /** @throws AiDisabledError while the switch is off; ProductNotFoundError for any product not of the store */
  async polish(ctx: OperationContext, scope: StoreScope, productId: string): Promise<PolishedProductView> {
    if (!(await this.deps.ai.isEnabled(scope))) throw new AiDisabledError();
    const text = await this.deps.products.textOf(ctx, scope, productId);
    if (text === undefined) throw new ProductNotFoundError();
    return { productId, ...(await this.deps.polisher.polish(scope, text)) };
  }
}
