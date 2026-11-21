import type { ProductPolisher, ProductText } from '../application/ports/product-polisher.port';
import type { StoreScope } from '../domain/store-scope';

/** The polisher of P2.S2 (D2215): the text comes back unchanged until P9.S7b plugs the AI one in. */
export class IdentityPolisher implements ProductPolisher {
  polish(_scope: StoreScope, text: ProductText): Promise<ProductText> {
    return Promise.resolve(text);
  }
}
