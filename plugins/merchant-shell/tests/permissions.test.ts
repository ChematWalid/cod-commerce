import { vendurePermissionName } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { channelHolds } from '../dashboard/model/permissions';

const channels = [
  { id: '1', permissions: [vendurePermissionName('settings.business.view')] },
  { id: '2', permissions: [vendurePermissionName('settings.business.edit')] },
];

describe('channelHolds', () => {
  it('reads the permissions of the named channel only', () => {
    expect(channelHolds(channels, '1', 'settings.business.view')).toBe(true);
    expect(channelHolds(channels, '1', 'settings.business.edit')).toBe(false);
    expect(channelHolds(channels, '2', 'settings.business.edit')).toBe(true);
  });

  it('is false while the session or the channel is unknown', () => {
    expect(channelHolds(undefined, '1', 'settings.business.view')).toBe(false);
    expect(channelHolds(channels, undefined, 'settings.business.view')).toBe(false);
    expect(channelHolds(channels, '9', 'settings.business.view')).toBe(false);
  });
});
