import type { OperationContext } from '../domain/ports/operation-context';
import type { RuleOptions } from '../domain/ports/product-facts.port';
import type { StoreScope } from '../domain/store-scope';
import type { CollectionPorts } from './collection-ports';

/**
 * What the condition builder offers (D2321, AC3): the active store's brands, tags and every option name with its
 * values, read in one aggregate through the catalog (D2308). Another store's names never appear.
 */
export class RuleOptionsService {
  constructor(private readonly ports: CollectionPorts) {}

  of(ctx: OperationContext, scope: StoreScope): Promise<RuleOptions> {
    return this.ports.facts.ruleOptionsOf(ctx, scope);
  }
}
