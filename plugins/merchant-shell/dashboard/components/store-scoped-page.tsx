import type { PermissionKey } from '@cod/shared';
import { type ReactNode, useMemo } from 'react';
import { storeScopedLeaf } from '../model/leaf-view';
import type { ShellPageProps } from '../model/types';
import { LeafGate } from './shell-leaf-page';

/** What a store-scoped page asks for: the permission it needs on its store, and what it shows once it may. */
export interface StoreScopedPageProps {
  readonly permission: PermissionKey;
  readonly children: (props: ShellPageProps) => ReactNode;
}

/**
 * Wraps a page below `/stores/$storeId/` that is not a sidebar leaf (an editor, a detail page, D2110): the URL's store
 * is resolved or switched to, an unknown or foreign one is not found, and `permission` is checked on that store, as
 * for a leaf. Presentation only: the server enforces access again.
 */
export function StoreScopedPage({ permission, children }: StoreScopedPageProps): ReactNode {
  const leaf = useMemo(() => storeScopedLeaf(permission), [permission]);
  return <LeafGate leaf={leaf}>{(view) => children({ store: view.store })}</LeafGate>;
}
