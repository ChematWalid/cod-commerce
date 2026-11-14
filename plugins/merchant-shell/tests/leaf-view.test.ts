import { vendurePermissionName } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { decideLeafView, type LeafViewInput, storeScopedLeaf } from '../dashboard/model/leaf-view';
import { SHELL_LEAVES, type ShellLeaf } from '../dashboard/model/tree';
import type { SwitchableStoreView } from '../dashboard/model/types';

const leafOf = (id: string): ShellLeaf => {
  const found = SHELL_LEAVES.find((leaf) => leaf.id === id);
  if (found === undefined) throw new Error(`no leaf ${id}`);
  return found;
};

const store = (id: string, channelId: string): SwitchableStoreView => ({
  id,
  businessId: 'b1',
  channelId,
  name: `Store ${id}`,
  subdomain: `s${id}`,
  language: 'ar',
});

const A1 = store('101', '1');
const A2 = store('102', '2');
const PRODUCTS_VIEW = vendurePermissionName('catalog.products.view');
const PRODUCTS = leafOf('products.all');
const A1_CHANNEL = { id: '1', permissions: [PRODUCTS_VIEW] };
const A2_CHANNEL = { id: '2', permissions: [] };
const ON_A1_ONLY = [A1_CHANNEL, A2_CHANNEL];

const input = (over: Partial<LeafViewInput>): LeafViewInput => ({
  leaf: PRODUCTS,
  storeParam: 'active',
  activeChannelId: '1',
  stores: [A1, A2],
  channels: ON_A1_ONLY,
  ...over,
});

describe('decideLeafView', () => {
  it.each([
    ['the active channel', { activeChannelId: undefined }],
    ['the switchable stores', { stores: undefined }],
    ['the user channels', { channels: undefined }],
  ])('waits for %s and decides nothing before', (_name, over) => {
    expect(decideLeafView(input(over))).toEqual({ kind: 'loading' });
  });

  it('asks for a switch before reading any permission, so a store the active one forbids does not flash forbidden', () => {
    expect(decideLeafView(input({ storeParam: A2.id, channels: [{ id: '1', permissions: [] }, A2_CHANNEL] }))).toEqual({
      kind: 'switch',
      channelId: A2.channelId,
    });
  });

  it('checks the permission on the store the URL resolved to, once it is active', () => {
    expect(decideLeafView(input({ storeParam: A2.id, activeChannelId: '2' }))).toEqual({ kind: 'forbidden' });
    expect(decideLeafView(input({ storeParam: A1.id, activeChannelId: '1' }))).toEqual({ kind: 'page', store: A1 });
  });

  it('hands the page the active store for the alias', () => {
    expect(decideLeafView(input({}))).toEqual({ kind: 'page', store: A1 });
  });

  it('shows not found for a store outside the switchable list', () => {
    expect(decideLeafView(input({ storeParam: '999' }))).toEqual({ kind: 'not-found' });
  });

  it('shows not found for a listed store whose channel the session does not carry', () => {
    expect(decideLeafView(input({ storeParam: A2.id, channels: [A1_CHANNEL] }))).toEqual({ kind: 'not-found' });
  });

  it('keeps waiting while the active channel is outside the list, because the store session moves it', () => {
    expect(decideLeafView(input({ activeChannelId: '9' }))).toEqual({ kind: 'loading' });
  });

  it('shows not found when the caller has no store at all', () => {
    expect(decideLeafView(input({ stores: [] }))).toEqual({ kind: 'not-found' });
  });

  it('renders a leaf that needs no permission, with no store on an account-level leaf', () => {
    expect(
      decideLeafView(input({ leaf: leafOf('home'), storeParam: undefined, channels: [{ id: '1', permissions: [] }] })),
    ).toEqual({ kind: 'page', store: undefined });
  });

  it('accepts any one of several permissions', () => {
    const channels = [{ id: '1', permissions: [vendurePermissionName('delivery.pricing.view')] }];
    expect(decideLeafView(input({ leaf: leafOf('delivery'), storeParam: undefined, channels })).kind).toBe('page');
  });

  it('is forbidden when the active channel is not in the session', () => {
    expect(decideLeafView(input({ leaf: leafOf('orders.all'), storeParam: undefined, channels: [] }))).toEqual({
      kind: 'forbidden',
    });
  });

  describe('a store-scoped page outside the tree (StoreScopedPage, D2110)', () => {
    const editor = storeScopedLeaf('catalog.products.edit');

    it('resolves the store before the permission, like a leaf', () => {
      expect(decideLeafView(input({ leaf: editor, storeParam: A2.id }))).toEqual({
        kind: 'switch',
        channelId: A2.channelId,
      });
      expect(decideLeafView(input({ leaf: editor, storeParam: '999' }))).toEqual({ kind: 'not-found' });
    });

    it('checks its own permission on the store the URL resolved to', () => {
      const channels = [{ id: '1', permissions: [vendurePermissionName('catalog.products.edit')] }, A2_CHANNEL];
      expect(decideLeafView(input({ leaf: editor, channels }))).toEqual({ kind: 'page', store: A1 });
      expect(decideLeafView(input({ leaf: editor }))).toEqual({ kind: 'forbidden' });
    });
  });
});
