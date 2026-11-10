import type { SwitchableStoreView } from './types';

/** What the store session reads. */
export interface StoreSessionInput {
  readonly activeChannelId: string;
  readonly stores: readonly SwitchableStoreView[];
  readonly contentLanguage: string;
}

/** What the store session should do next; empty when nothing is needed. */
export interface StoreSessionAction {
  readonly switchTo?: string;
  readonly contentLanguage?: string;
}

/**
 * Keeps the session on a store the merchant can use (D86): an active channel outside the list (archived, or access
 * removed) moves to the first store. A store offers exactly its own language (D7), so any other content language
 * moves to it. The stock rule only runs while the stock channel switcher is mounted, which is never for a merchant.
 */
export function nextStoreAction({ activeChannelId, stores, contentLanguage }: StoreSessionInput): StoreSessionAction {
  const active = stores.find((store) => store.channelId === activeChannelId);
  if (active === undefined) {
    const first = stores[0];
    return first === undefined ? {} : { switchTo: first.channelId };
  }
  return contentLanguage === active.language ? {} : { contentLanguage: active.language };
}
