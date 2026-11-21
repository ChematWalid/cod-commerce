import { PRICING_CHANNELS, type PricingChannel } from '@cod/shared';

/** Whether `channel` is ticked: an empty list means every channel (D2420). */
export const isChannelOn = (channels: readonly PricingChannel[], channel: PricingChannel): boolean =>
  channels.length === 0 || channels.includes(channel);

/**
 * The channel list after ticking or unticking `channel`, in catalogue order. Ticking every channel gives back the empty
 * list ("everywhere"); the last ticked channel cannot be unticked, as an empty list would mean every channel again.
 */
export function toggleChannel(
  channels: readonly PricingChannel[],
  channel: PricingChannel,
  on: boolean,
): readonly PricingChannel[] {
  const ticked = PRICING_CHANNELS.filter((each) => (each === channel ? on : isChannelOn(channels, each)));
  if (ticked.length === 0) return channels;
  return ticked.length === PRICING_CHANNELS.length ? [] : ticked;
}
