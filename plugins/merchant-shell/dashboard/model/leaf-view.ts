import { type PermissionKey, vendurePermissionName } from '@cod/shared';
import { resolveStoreParam } from './store-path';
import type { ShellLeaf } from './tree';
import type { SwitchableStoreView } from './types';

/** A channel of the session and the permissions it grants, as `me.channels` holds them. */
export interface SessionChannel {
  readonly id: string;
  readonly permissions: readonly string[];
}

/** What a leaf's route needs to know. Undefined means still loading. */
export interface LeafViewInput {
  readonly leaf: ShellLeaf;
  /** The `$storeId` URL parameter; unset on an account-level leaf. */
  readonly storeParam: string | undefined;
  readonly activeChannelId: string | undefined;
  readonly stores: readonly SwitchableStoreView[] | undefined;
  readonly channels: readonly SessionChannel[] | undefined;
}

/** What a leaf's route shows. */
export type LeafView =
  | { readonly kind: 'loading' }
  | { readonly kind: 'switch'; readonly channelId: string }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'page'; readonly store: SwitchableStoreView | undefined };

const LOADING: LeafView = { kind: 'loading' };
const NOT_FOUND: LeafView = { kind: 'not-found' };

/** Whether `channel` grants the leaf: no permission asked, or any one of those it lists. */
function grants(leaf: ShellLeaf, channel: SessionChannel | undefined): boolean {
  if (leaf.permissions.length === 0) return true;
  return leaf.permissions.some((key) => channel?.permissions.includes(vendurePermissionName(key)));
}

/** Resolves the store of a store-scoped leaf: the view to show instead, or the store the session is on. */
function resolveStore(
  param: string,
  activeChannelId: string,
  stores: readonly SwitchableStoreView[],
  channels: readonly SessionChannel[],
): LeafView | SwitchableStoreView {
  const active = stores.find((store) => store.channelId === activeChannelId);
  const resolution = resolveStoreParam(param, active?.id, stores);
  if (resolution.kind === 'not-found') return NOT_FOUND;
  if (resolution.kind === 'switch') {
    const channelId = stores.find((store) => store.id === resolution.id)?.channelId;
    if (channelId === undefined || !channels.some((channel) => channel.id === channelId)) return NOT_FOUND;
    return { kind: 'switch', channelId };
  }
  if (active !== undefined) return active;
  // An active channel outside the list is moved by the store session, unless there is nowhere to move to.
  return stores.length === 0 ? NOT_FOUND : LOADING;
}

const isView = (value: LeafView | SwitchableStoreView): value is LeafView => 'kind' in value;

/**
 * Decides a leaf in the only safe order: wait for the session, resolve the URL's store (asking for a switch and waiting
 * for it), and only then read the permission, on the channel that is now active. Reading it earlier would flash
 * forbidden for a member whose role differs per store. Presentation only: the server enforces access.
 */
export function decideLeafView({ leaf, storeParam, activeChannelId, stores, channels }: LeafViewInput): LeafView {
  if (activeChannelId === undefined || stores === undefined || channels === undefined) return LOADING;
  let store: SwitchableStoreView | undefined;
  if (leaf.storeScoped) {
    const resolved = resolveStore(storeParam ?? '', activeChannelId, stores, channels);
    if (isView(resolved)) return resolved;
    store = resolved;
  }
  const allowed = grants(
    leaf,
    channels.find((channel) => channel.id === activeChannelId),
  );
  return allowed ? { kind: 'page', store } : { kind: 'forbidden' };
}

/** The id of a {@link storeScopedLeaf}: it names no sidebar entry and is never registered. */
const STORE_SCOPED_PAGE_ID = 'store-scoped-page';
/** Such a page shows no sidebar title or crumb of the shell: the page titles itself. */
const UNTITLED_PAGE = '';

/**
 * A store-scoped page outside the sidebar tree, such as a product editor below `/stores/$storeId/products/` (D2110),
 * decided like a store leaf: its store first, then `permission` on that store.
 */
export function storeScopedLeaf(permission: PermissionKey): ShellLeaf {
  return {
    id: STORE_SCOPED_PAGE_ID,
    titleId: UNTITLED_PAGE,
    path: '',
    permissions: [permission],
    storeScoped: true,
    ownerSession: null,
  };
}
