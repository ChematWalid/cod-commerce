import { useQueryClient } from '@tanstack/react-query';
import { useChannel } from '@vendure/dashboard';
import { useEffect, useRef } from 'react';
import { ACTIVE_CHANNEL_QUERY_KEY, SELECTED_CHANNEL_TOKEN_STORAGE_KEY } from '../constants';

/** The token requests are sent with, or null when the browser's storage cannot be read or holds none yet. */
function readStoredToken(): string | null {
  try {
    return localStorage.getItem(SELECTED_CHANNEL_TOKEN_STORAGE_KEY);
  } catch (error: unknown) {
    console.error('Could not read the selected channel token', error);
    return null;
  }
}

/** The active channel, as far as this hook knows the one requests go to. */
export interface SettledActiveChannel {
  readonly activeChannelId: string | undefined;
  readonly setActiveChannel: (channelId: string) => void;
}

/**
 * The active channel, undefined while it disagrees with the token that requests carry. The stock provider can rewrite
 * the token after the channel has loaded (from the user's saved channel) without the query following, which would
 * show one store's page while every request goes to another. Refetches once per token and waits for the answer.
 */
export function useSettledActiveChannel(): SettledActiveChannel {
  const { activeChannel, setActiveChannel } = useChannel();
  const queryClient = useQueryClient();
  const refetchedFor = useRef<string | null>(null);
  const stored = readStoredToken();
  const stale = activeChannel !== undefined && stored !== null && stored !== activeChannel.token;
  useEffect(() => {
    if (!stale) {
      refetchedFor.current = null;
      return;
    }
    if (refetchedFor.current === stored) return;
    refetchedFor.current = stored;
    void queryClient.invalidateQueries({ queryKey: ACTIVE_CHANNEL_QUERY_KEY });
  }, [stale, stored, queryClient]);
  return { activeChannelId: stale ? undefined : activeChannel?.id, setActiveChannel };
}
