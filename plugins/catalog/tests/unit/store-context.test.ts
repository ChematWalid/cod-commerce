import type { BusinessStoreDirectory } from '@cod/plugin-tenancy';
import { toBusinessId, toStoreId } from '@cod/shared';
import type { Channel, ChannelService, RequestContext, RequestContextService } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import type { StoreScope } from '../../domain/store-scope';
import { CatalogStoreContexts } from '../../infrastructure/store-context';

const SCOPE: StoreScope = { businessId: toBusinessId('1001'), storeId: toStoreId('2001') };
const STORE_CHANNEL = { id: 7 } as unknown as Channel;
const DEFAULT_CHANNEL = { id: 1 } as unknown as Channel;

/** A context standing in for Vendure's: `copy(channel)` keeps whatever else it carries, as Vendure's does. */
function aContext(channel: Channel, carried: Record<string, unknown> = {}): RequestContext {
  const ctx = {
    ...carried,
    channelId: channel.id,
    copy: (next: Channel) => aContext(next, carried),
  };
  return ctx as unknown as RequestContext;
}

function arranged() {
  const directoryContexts: unknown[] = [];
  const created: unknown[] = [];
  const directory = {
    isActiveBusiness: (ctx: unknown) => {
      directoryContexts.push(ctx);
      return Promise.resolve(true);
    },
    storesOf: () => Promise.resolve([{ id: SCOPE.storeId, status: 'active', channelId: 7 }]),
  } as unknown as BusinessStoreDirectory;
  const channels = {
    findOne: () => Promise.resolve(STORE_CHANNEL),
    getDefaultChannel: () => Promise.resolve(DEFAULT_CHANNEL),
  } as unknown as ChannelService;
  const contexts = {
    create: (input: { channelOrToken?: Channel }) => {
      created.push(input);
      return Promise.resolve(aContext(input.channelOrToken ?? DEFAULT_CHANNEL));
    },
  } as unknown as RequestContextService;
  return { stores: new CatalogStoreContexts(directory, channels, contexts), directoryContexts, created };
}

describe('CatalogStoreContexts.storeContext', () => {
  it('builds a fresh store-channel context when it is given none to join', async () => {
    // Arrange
    const { stores, created } = arranged();

    // Act
    const ctx = await stores.storeContext(SCOPE);

    // Assert
    expect(ctx.channelId).toBe(7);
    expect(created).toHaveLength(2);
  });

  it('joins the transaction of the context it is given: every read and the answer carry it (#260, D2282)', async () => {
    // Arrange
    const { stores, created, directoryContexts } = arranged();
    const within = aContext(DEFAULT_CHANNEL, { transaction: 'delivery' });

    // Act
    const ctx = await stores.storeContext(SCOPE, within);

    // Assert
    expect(created).toEqual([]);
    expect(directoryContexts[0]).toBe(within);
    expect(ctx).toMatchObject({ channelId: 7, transaction: 'delivery' });
  });
});
