import type { ReactNode } from 'react';
import { tFromSetting } from '../../i18n/messages';
import type { SectionProps } from '../section-props';

/** A one-line strip above the header; its text is a catalogue key from the theme (`messageKey`). */
export function AnnouncementBar({ section, data }: SectionProps): ReactNode {
  return (
    <p className="announcement-bar">
      {tFromSetting(data.locale, section.settings['messageKey'], 'announcement.default')}
    </p>
  );
}
