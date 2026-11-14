import type { ProductCommand } from '@cod/shared';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { planVariantMatrix } from '../domain/variant-matrix';
import type { ProductPorts } from './catalog-ports';
import { fieldsOfCommand, slugOf } from './product-fields';
import { ProductReferenceCheck } from './product-references';
import { type ProductSaveResult, saveLinks, viewOf, warningsOf } from './product-view';

/**
 * "Create a product" in the caller's active store: checks every id it names, plans its variants from its options
 * (D2124), stores it with its links and settings and publishes `product.changed` in one transaction (D2127). An old
 * price below the price is a warning, never a refusal (AC3).
 */
export class CreateProductService {
  private readonly references: ProductReferenceCheck;

  constructor(private readonly ports: ProductPorts) {
    this.references = new ProductReferenceCheck(ports);
  }

  async create(ctx: OperationContext, scope: StoreScope, command: ProductCommand): Promise<ProductSaveResult> {
    const references = { ...command, orderManagerIds: command.settings?.orderManagerIds };
    return this.ports.transaction.run(ctx, scope, async (tx) => {
      // Checked under the shared taxonomy locks, so no brand, tag or highlight it names is deleted before it commits.
      await this.references.lockNamed(tx, references);
      const refs = await this.references.check(tx, scope, references);
      await this.references.shareImages(tx, references);
      const fields = fieldsOfCommand(command, refs, this.ports.sanitizer);
      const plan = planVariantMatrix({
        productName: fields.title,
        baseSku: fields.sku,
        basePrice: fields.price,
        groups: command.optionGroups,
        existing: [],
      });
      const draft = { ...fields, slug: slugOf(command.slug), optionGroups: command.optionGroups };
      const record = await this.ports.products.create(tx, draft, plan);
      await saveLinks(this.ports, tx, { scope, productId: record.id }, { refs, settings: command.settings });
      await this.ports.events.publish(tx, scope, record.id, 'created');
      return { product: await viewOf(this.ports, tx, scope, record), warnings: warningsOf(record) };
    });
  }
}
