import { PRICING_CHANNELS, type PricingChannel } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { ReactNode } from 'react';
import { isChannelOn, toggleChannel } from '../../model/channel-choice';
import { CheckRow } from '../check-row';
import type { SectionProps } from './section-props';

/** Where the offer is shown; the third-party order form is named in our own words (ADR 0007). */
const CHANNEL_LABEL_IDS: Readonly<Record<PricingChannel, string>> = {
  storefront: 'offers.editor-channel-storefront',
  landing_page: 'offers.editor-channel-landing-page',
  order_form_app: 'offers.editor-channel-order-form-app',
  dashboard: 'offers.editor-channel-dashboard',
  app: 'offers.editor-channel-app',
};

/** The five channels; all ticked is stored as "every channel" (D2420). */
export function ChannelsSection({ form, disabled, onChange }: SectionProps): ReactNode {
  const { i18n } = useLingui();
  const { channels } = form.eligibility;
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{i18n._('offers.editor-channels')}</legend>
      {PRICING_CHANNELS.map((channel) => (
        <CheckRow
          key={channel}
          label={i18n._(CHANNEL_LABEL_IDS[channel])}
          checked={isChannelOn(channels, channel)}
          disabled={disabled}
          onToggle={(on) => {
            onChange({ eligibility: { ...form.eligibility, channels: [...toggleChannel(channels, channel, on)] } });
          }}
        />
      ))}
      <p className="text-muted-foreground text-xs">{i18n._('offers.editor-channels-hint')}</p>
    </fieldset>
  );
}
