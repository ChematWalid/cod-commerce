import { useLocation, useNavigate } from '@tanstack/react-router';
import { useAuth, useChannel, useUserSettings } from '@vendure/dashboard';
import { useCallback, useEffect, useRef } from 'react';
import { rewriteToActiveStore } from '../model/store-path';
import { nextStoreAction } from '../model/store-session';
import type { SwitchableStoreView } from '../model/types';
import { useSwitchableStores } from '../queries';
import { useSettledActiveChannel } from './use-settled-active-channel';

/**
 * Calls `refreshChannels()` once per failure of the active-channel query, or of the stores query keyed by it, so an
 * access change that removed the store recovers without a reload and a persistent failure cannot loop. The stock
 * provider then moves off the store the session has lost, and the token follows.
 */
function useChannelRecovery(storesFailed: boolean): void {
  const { activeChannel, isLoading, refreshChannels } = useChannel();
  const { isAuthenticated } = useAuth();
  const attempted = useRef(false);
  const failed = isAuthenticated && !isLoading && (activeChannel === undefined || storesFailed);
  useEffect(() => {
    if (!failed) {
      attempted.current = false;
      return;
    }
    if (attempted.current) return;
    attempted.current = true;
    refreshChannels();
  }, [failed, refreshChannels]);
}

/** Applies {@link nextStoreAction}, one switch per target, and rewrites nothing: the URL stays the leaf's business. */
function useStoreActions(
  activeChannelId: string | undefined,
  stores: readonly SwitchableStoreView[] | undefined,
  setActiveChannel: (channelId: string) => void,
): void {
  const {
    settings: { contentLanguage },
    setContentLanguage,
  } = useUserSettings();
  const requested = useRef<string | undefined>(undefined);
  const action =
    activeChannelId === undefined || stores === undefined
      ? {}
      : nextStoreAction({ activeChannelId, stores, contentLanguage });
  const { switchTo, contentLanguage: language } = action;
  useEffect(() => {
    if (switchTo === undefined) {
      requested.current = undefined;
      return;
    }
    if (requested.current === switchTo) return;
    requested.current = switchTo;
    setActiveChannel(switchTo);
  }, [switchTo, setActiveChannel]);
  useEffect(() => {
    if (language !== undefined) setContentLanguage(language);
  }, [language, setContentLanguage]);
}

/** The stores the merchant can use, the active one and the switch action, for the always-mounted switcher (D86). */
export interface StoreSession {
  /** Undefined while loading; only stores the session already holds a channel for, as a switch needs one. */
  readonly stores: readonly SwitchableStoreView[] | undefined;
  readonly activeChannelId: string | undefined;
  readonly activeStore: SwitchableStoreView | undefined;
  readonly platformDomain: string | undefined;
  /** Moves the URL to `active` first, so a render with the old store id cannot ask to switch back (Review Focus 3). */
  readonly switchTo: (channelId: string) => Promise<void>;
}

/** Keeps the session on a usable store and offers the switch. Mounted once, by the toolbar's store switcher. */
export function useStoreSession(): StoreSession {
  const { activeChannelId, setActiveChannel } = useSettledActiveChannel();
  const { channels } = useAuth();
  const query = useSwitchableStores(activeChannelId);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useChannelRecovery(query.isError);
  const stores =
    query.data === undefined || channels === undefined
      ? undefined
      : query.data.stores.filter((store) => channels.some((channel) => channel.id === store.channelId));
  useStoreActions(query.isError ? undefined : activeChannelId, stores, setActiveChannel);
  const switchTo = useCallback(
    async (channelId: string): Promise<void> => {
      const rewritten = rewriteToActiveStore(pathname);
      if (rewritten !== null && rewritten !== pathname) await navigate({ to: rewritten, replace: true });
      setActiveChannel(channelId);
    },
    [pathname, navigate, setActiveChannel],
  );
  return {
    stores,
    activeChannelId,
    activeStore: stores?.find((store) => store.channelId === activeChannelId),
    platformDomain: query.data?.platformDomain,
    switchTo,
  };
}

/** The store the session is on, once it is known. Safe from any component under the app's providers. */
export function useActiveStore(): SwitchableStoreView | undefined {
  const { activeChannelId } = useSettledActiveChannel();
  const { data } = useSwitchableStores(activeChannelId);
  return data?.stores.find((store) => store.channelId === activeChannelId);
}
