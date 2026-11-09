import { useParams } from '@tanstack/react-router';
import { ErrorPage, useAuth } from '@vendure/dashboard';
import { type ReactNode, useEffect, useRef } from 'react';
import { SHELL_FORBIDDEN_TEST_ID } from '../constants';
import { useSettledActiveChannel } from '../hooks/use-settled-active-channel';
import { decideLeafView, type LeafView } from '../model/leaf-view';
import type { ShellLeaf, ShellLeafId } from '../model/tree';
import { useSwitchableStores } from '../queries';
import { getShellPage } from '../registry/shell-pages';
import { MerchantNotFound } from './merchant-route-guard';
import { SkeletonPage } from './skeleton-page';

/**
 * Asks for the store switch once per target. `setActiveChannel` changes identity with the channel list, and a repeat
 * would invalidate every query again.
 */
function useStoreSwitch(view: LeafView, setActiveChannel: (channelId: string) => void): void {
  const requested = useRef<string | undefined>(undefined);
  const target = view.kind === 'switch' ? view.channelId : undefined;
  useEffect(() => {
    if (target === undefined) {
      requested.current = undefined;
      return;
    }
    if (requested.current === target) return;
    requested.current = target;
    setActiveChannel(target);
  }, [target, setActiveChannel]);
}

/** What a leaf renders once it may: the page another plugin registered (read at render, D83), else the skeleton. */
function LeafContent({
  leaf,
  view,
}: {
  readonly leaf: ShellLeaf<ShellLeafId>;
  readonly view: Extract<LeafView, { kind: 'page' }>;
}): ReactNode {
  const page = getShellPage(leaf.id);
  if (page === undefined) return <SkeletonPage leaf={leaf} />;
  const Component = page.component;
  return <Component store={view.store} />;
}

/**
 * The route component of every leaf. Waits for the active channel and the stores, resolves the URL's store (switching
 * and waiting for the new channel if needed), and only then checks the permission on that channel.
 */
export function ShellLeafPage({ leaf }: { readonly leaf: ShellLeaf<ShellLeafId> }): ReactNode {
  const { storeId }: { readonly storeId?: string } = useParams({ strict: false });
  const { activeChannelId, setActiveChannel } = useSettledActiveChannel();
  const { channels } = useAuth();
  const stores = useSwitchableStores(activeChannelId);
  const view = decideLeafView({
    leaf,
    storeParam: storeId,
    activeChannelId,
    stores: stores.data?.stores,
    channels,
  });
  useStoreSwitch(view, setActiveChannel);
  if (stores.isError) return <ErrorPage error={stores.error} />;
  switch (view.kind) {
    case 'page':
      return <LeafContent leaf={leaf} view={view} />;
    case 'forbidden':
      return (
        <div data-testid={SHELL_FORBIDDEN_TEST_ID} className="contents">
          <ErrorPage kind="forbidden" />
        </div>
      );
    case 'not-found':
      return <MerchantNotFound />;
    default:
      return null;
  }
}
