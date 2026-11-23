import type { TenantScope } from '@cod/shared';
import type { SynonymPair } from '../search-query';
import type { OperationContext } from './operation-context';

/** A business's search synonyms (ADR 0014): one table per platform, every call confined to the business. */
export interface SynonymRepositoryPort {
  /** Stores `pairs` for the business when it has no synonym yet; a business that has some keeps its own. */
  seedIfEmpty(ctx: OperationContext, business: TenantScope, pairs: readonly SynonymPair[]): Promise<void>;

  /** The business's pairs with one of `words` on either side. */
  matching(ctx: OperationContext, business: TenantScope, words: readonly string[]): Promise<readonly SynonymPair[]>;
}
