import { describe, expect, it } from 'vitest';
import { nextStoreAction } from '../dashboard/model/store-session';
import type { SwitchableStoreView } from '../dashboard/model/types';

const store = (channelId: string, language = 'ar'): SwitchableStoreView => ({
  id: `store-${channelId}`,
  businessId: 'business-1',
  channelId,
  name: `Store ${channelId}`,
  subdomain: `store-${channelId}`,
  language,
});

describe('nextStoreAction', () => {
  it('moves to the first store when the active channel is outside the list', () => {
    const stores = [store('2'), store('3')];

    expect(nextStoreAction({ activeChannelId: '9', stores, contentLanguage: 'ar' })).toEqual({ switchTo: '2' });
  });

  it('does nothing with an empty list', () => {
    expect(nextStoreAction({ activeChannelId: '9', stores: [], contentLanguage: 'ar' })).toEqual({});
  });

  it('moves the content language to the language of the active store when the store does not offer it', () => {
    const stores = [store('2', 'fr')];

    expect(nextStoreAction({ activeChannelId: '2', stores, contentLanguage: 'ar' })).toEqual({
      contentLanguage: 'fr',
    });
  });

  it('leaves the content language alone when the store offers it', () => {
    const stores = [store('2', 'fr')];

    expect(nextStoreAction({ activeChannelId: '2', stores, contentLanguage: 'fr' })).toEqual({});
  });
});
