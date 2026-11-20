import type { CollectionChangeKind, TenantScope } from '@cod/shared';
import type { CollectionPorts } from '../../application/collection-ports';
import type { CollectionEventsPort } from '../../domain/ports/collection-events.port';
import type { DescriptionSanitizerPort } from '../../domain/ports/description-sanitizer.port';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import type { StoreLockPort } from '../../domain/ports/store-lock.port';
import type { TransactionPort } from '../../domain/ports/transaction.port';
import type { StoreScope } from '../../domain/store-scope';
import { newId } from '../support/builders';
import { FakeProductFacts } from './fake-product-facts';
import { FakeStoreLocks } from './fake-store-locks';
import { FakeVendureCollections } from './fake-vendure-collections';
import { InMemoryCollectionTables } from './in-memory-collection-tables';

/** One published `collection.changed`. */
export interface PublishedChange {
  readonly scope: StoreScope;
  readonly collectionId: string;
  readonly change: CollectionChangeKind;
}

/** What the fakes saw happen, in order: transactions, store locks and the ports written. */
export type Step = 'transaction' | `lock ${string}` | 'count';

/** Records every published change, in order. */
class RecordingEvents implements CollectionEventsPort {
  readonly published: PublishedChange[] = [];

  publish(
    _ctx: OperationContext,
    scope: StoreScope,
    collectionId: string,
    change: CollectionChangeKind,
  ): Promise<void> {
    this.published.push({ scope, collectionId, change });
    return Promise.resolve();
  }
}

/** Strips tags and keeps their text, standing in for the HTML sanitiser. */
const stripTags: DescriptionSanitizerPort = { sanitize: (html) => html.replaceAll(/<[^>]*>/g, '') };

/** The use cases' ports over in-memory fakes, with a log of the transaction and lock steps. */
export class FakeCollectionWorld {
  readonly tables = new InMemoryCollectionTables();
  readonly vendure = new FakeVendureCollections();
  readonly events = new RecordingEvents();
  readonly facts = new FakeProductFacts();
  readonly locks = new FakeStoreLocks();
  readonly steps: Step[] = [];
  readonly ports: CollectionPorts;

  constructor() {
    const transaction: TransactionPort = {
      // Joins a transaction `ctx` already is, like Vendure's `withTransaction`; a new one ends with its locks.
      run: async <T>(ctx: OperationContext, _scope: TenantScope, work: (tx: OperationContext) => Promise<T>) => {
        this.steps.push('transaction');
        if (this.locks.isTransaction(ctx)) return work(ctx);
        const tx = asOperationContext({ transactionOf: ctx });
        this.locks.begin(tx);
        try {
          return await work(tx);
        } finally {
          this.locks.end(tx);
        }
      },
    };
    const lock: StoreLockPort = {
      lockStore: (ctx, storeId) => {
        this.steps.push(`lock ${storeId}`);
        return this.locks.acquire(ctx, storeId);
      },
    };
    const definitions = this.tables.definitions;
    const countInStore = definitions.countInStore.bind(definitions);
    const counted = Object.assign(Object.create(definitions) as typeof definitions, {
      countInStore: (ctx: OperationContext, scope: StoreScope) => {
        this.steps.push('count');
        return countInStore(ctx, scope);
      },
    });
    this.ports = {
      transaction,
      lock,
      definitions: counted,
      members: this.tables.members,
      vendure: this.vendure,
      events: this.events,
      ids: { next: newId },
      sanitizer: stripTags,
      facts: this.facts,
    };
  }
}
