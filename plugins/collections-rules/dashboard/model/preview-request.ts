import { PREVIEW_DELAY_MS } from '../constants';
import type { StoreCollectionProductPageDto, StoreCollectionRuleDto } from '../dto';
import { fetchForStore, isStoreSwitched } from './store-bound-fetch';

/** The store a preview is asked for (the shape of `StoreScope`, kept here so this module stays framework-free). */
export interface PreviewScope {
  readonly storeId: string;
  readonly channelToken: string;
}

/** What the preview panel shows. */
export type PreviewState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'answered'; readonly page: StoreCollectionProductPageDto }
  | { readonly kind: 'failed'; readonly error: unknown };

/** Where a preview's answer comes from: the channel token requests carry, and the server's preview. */
export interface PreviewSource {
  readonly readToken: () => string | null;
  readonly fetchPreview: (rule: StoreCollectionRuleDto) => Promise<StoreCollectionProductPageDto>;
}

/**
 * Asks for a live preview of an unsaved rule (D2331): `delayMs` after the last change, never saving. Only the answer
 * to the latest request is shown; one fetched after a store switch is dropped (D2160), since it counts another
 * store's products.
 */
export class PreviewRequester {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;

  constructor(
    private readonly source: PreviewSource,
    private readonly show: (state: PreviewState) => void,
    private readonly delayMs = PREVIEW_DELAY_MS,
  ) {}

  /** A new draft: forgets the pending one, then asks for this one after the delay (idle without a rule). */
  request(scope: PreviewScope | null, rule: StoreCollectionRuleDto | null): void {
    this.cancel();
    const generation = this.generation;
    if (scope === null || rule === null) {
      this.show({ kind: 'idle' });
      return;
    }
    this.show({ kind: 'pending' });
    this.timer = setTimeout(() => {
      void this.send(generation, scope, rule);
    }, this.delayMs);
  }

  /** Stops the pending request and drops any answer still on its way. */
  cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.generation += 1;
  }

  private async send(generation: number, scope: PreviewScope, rule: StoreCollectionRuleDto): Promise<void> {
    try {
      const page = await fetchForStore(scope.channelToken, this.source.readToken, () => this.source.fetchPreview(rule));
      if (generation === this.generation) this.show({ kind: 'answered', page });
    } catch (error: unknown) {
      if (generation !== this.generation || isStoreSwitched(error)) return;
      this.show({ kind: 'failed', error });
    }
  }
}
