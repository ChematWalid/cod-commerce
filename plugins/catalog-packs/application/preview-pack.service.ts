import type { PackDefinition } from '../domain/pack';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { pricePack } from './pack-components';
import type { PackPorts } from './pack-ports';
import type { PackPreview } from './pack-view';

/** "Preview a pack": what a definition would cost and weigh in the store, saving nothing. */
export class PreviewPackService {
  constructor(private readonly ports: PackPorts) {}

  /** @throws the component and pricing refusals of `pricePack`. */
  async preview(ctx: OperationContext, scope: StoreScope, definition: PackDefinition): Promise<PackPreview> {
    const { computed } = await pricePack(this.ports, ctx, scope, { packProductId: null, definition });
    return {
      price: computed.price,
      weightGrams: computed.weightGrams,
      sharedValues: computed.sharedValues.map(({ value, price }) => ({ value, price })),
    };
  }
}
