import type { HighlightCommand } from '@cod/shared';
import { HighlightNotFoundError } from '../domain/errors';
import { createHighlight, type Highlight, rewordHighlight } from '../domain/highlight';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';
import { assertRoomFor, snowflakeIdOf } from './catalog-names';

/**
 * The highlights of the caller's active store (brief AC3: a product shows at most six of them): add, reword, list
 * and delete. A deleted highlight leaves every product; the others keep their order.
 */
export class HighlightService {
  constructor(private readonly ports: ProductPorts) {}

  list(ctx: OperationContext, scope: StoreScope): Promise<readonly Highlight[]> {
    return this.ports.highlights.list(ctx, scope);
  }

  async create(ctx: OperationContext, scope: StoreScope, command: HighlightCommand): Promise<Highlight> {
    const highlight = createHighlight({
      id: this.ports.ids.next(),
      scope,
      text: command.text,
      now: this.ports.clock.now(),
    });
    return await this.ports.transaction.run(ctx, scope, async (tx) => {
      await assertRoomFor(() => this.ports.highlights.count(tx, scope));
      await this.ports.highlights.insert(tx, scope, highlight);
      return highlight;
    });
  }

  async update(ctx: OperationContext, scope: StoreScope, rawId: string, command: HighlightCommand): Promise<Highlight> {
    const id = snowflakeIdOf(rawId, HighlightNotFoundError);
    return await this.ports.transaction.run(ctx, scope, async (tx) => {
      const current = await this.ports.highlights.findById(tx, scope, id);
      if (current === undefined) throw new HighlightNotFoundError();
      const reworded = rewordHighlight(current, command.text, this.ports.clock.now());
      if (!(await this.ports.highlights.update(tx, scope, reworded))) throw new HighlightNotFoundError();
      return reworded;
    });
  }

  async delete(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<void> {
    const id = snowflakeIdOf(rawId, HighlightNotFoundError);
    await this.ports.transaction.run(ctx, scope, async (tx) => {
      // First, so a product save naming the highlight either commits its link before the delete or finds it gone.
      await this.ports.taxonomyLock.exclusive(tx, id);
      if (!(await this.ports.highlights.delete(tx, scope, id))) throw new HighlightNotFoundError();
    });
  }
}
