import type { Snowflake } from '@cod/shared';
import type { CoreId } from '../../domain/core-id';
import type { Highlight } from '../../domain/highlight';
import type { HighlightRepositoryPort } from '../../domain/ports/highlight-repository.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import { inStore, newestFirst, type StoreRow } from './store-rows';

interface HighlightLink extends StoreRow {
  readonly productId: CoreId;
  readonly highlightId: Snowflake;
}

/** A store's highlights and ordered product links in memory; it passes the highlight contract. */
export class InMemoryHighlightRepository implements HighlightRepositoryPort {
  readonly rows: Highlight[] = [];
  readonly links: HighlightLink[] = [];

  private indexOf(scope: StoreScope, id: Snowflake): number {
    return this.rows.findIndex((row) => inStore(scope, row) && row.id === id);
  }

  private removeLinks(keep: (link: HighlightLink) => boolean): void {
    const kept = this.links.filter(keep);
    this.links.splice(0, this.links.length, ...kept);
  }

  insert(_ctx: OperationContext, scope: StoreScope, highlight: Highlight): Promise<void> {
    this.rows.push({ ...highlight, businessId: scope.businessId, storeId: scope.storeId });
    return Promise.resolve();
  }

  findById(_ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<Highlight | undefined> {
    return Promise.resolve(this.rows[this.indexOf(scope, id)]);
  }

  findByIds(_ctx: OperationContext, scope: StoreScope, ids: readonly Snowflake[]): Promise<readonly Highlight[]> {
    return Promise.resolve(this.rows.filter((row) => inStore(scope, row) && ids.includes(row.id)));
  }

  list(_ctx: OperationContext, scope: StoreScope): Promise<readonly Highlight[]> {
    return Promise.resolve(newestFirst(this.rows.filter((row) => inStore(scope, row))));
  }

  update(_ctx: OperationContext, scope: StoreScope, highlight: Highlight): Promise<boolean> {
    const index = this.indexOf(scope, highlight.id);
    if (index < 0) return Promise.resolve(false);
    const stored = this.rows[index] as Highlight;
    this.rows.splice(index, 1, { ...stored, text: highlight.text, updatedAt: highlight.updatedAt });
    return Promise.resolve(true);
  }

  delete(_ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<boolean> {
    const index = this.indexOf(scope, id);
    if (index < 0) return Promise.resolve(false);
    this.rows.splice(index, 1);
    this.removeLinks((link) => !(inStore(scope, link) && link.highlightId === id));
    return Promise.resolve(true);
  }

  replaceProductHighlights(
    _ctx: OperationContext,
    scope: StoreScope,
    productId: CoreId,
    highlightIds: readonly Snowflake[],
  ): Promise<void> {
    this.removeLinks((link) => !(inStore(scope, link) && link.productId === productId));
    const { businessId, storeId } = scope;
    this.links.push(...highlightIds.map((highlightId) => ({ businessId, storeId, productId, highlightId })));
    return Promise.resolve();
  }

  highlightIdsOf(_ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<readonly Snowflake[]> {
    const own = this.links.filter((link) => inStore(scope, link) && link.productId === productId);
    return Promise.resolve(own.map((link) => link.highlightId));
  }
}
